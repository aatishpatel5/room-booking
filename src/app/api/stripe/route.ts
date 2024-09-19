import { getRoom } from "@/libs/apis";
import { authOptions } from "@/libs/auth"; 
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import Stripe from "stripe"; 

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
}); 
 
type RequestData = {
  adults: number;
  checkinDate: string;
  checkoutDate: string;
  children: number;
  numberOfDays: number;
  hotelRoomSlug: string;
};

 
export async function POST(req: Request, res: Response) {
  const {
    adults,  
    checkinDate,
    checkoutDate,
    children,
    numberOfDays,
    hotelRoomSlug,
  }: RequestData = await req.json();
 
  if (
    !checkinDate ||
    !checkoutDate ||
    !adults ||
    !hotelRoomSlug ||
    !numberOfDays
  ) {
    return new NextResponse("Please all fields are required", { status: 400 });
  }

  const origin = req.headers.get("origin");

  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Authentication is required", { status: 400 });
  }

  const userId = session.user.id;
  const formattedCheckoutDate = checkoutDate.split("T")[0];
  const formattedCheckinDate = checkinDate.split("T")[0];

  try {
    const room = await getRoom(hotelRoomSlug);
    const discountPrice = room.price - (room.price / 100) * room.discount;
    const totalPrice = discountPrice * numberOfDays;

    // Create a stripe payment
    // const expressCheckoutElement = elements.create('expressCheckout');

    const stripeSession = await stripe.checkout.sessions.create({
    
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "inr",
             product_data: {
              name: room.name,
              images: room.images.map((image) => image.url),
            },
            unit_amount: parseInt((totalPrice * 100).toString()),
          },
        },
      ],
       payment_method_types: ["card"],

      success_url: `${origin}/users/${userId}`,
      metadata: {
        adults,
        checkinDate: formattedCheckinDate,
        checkoutDate: formattedCheckoutDate,
        children,
        hotelRoom: room._id,
        numberOfDays,
        user: userId,
        discount: room.discount,
        totalPrice,
      },
    }); 

    return NextResponse.json(stripeSession, {
      status: 200,
      statusText: "Payment session created",
    });
  } catch (error: any) {
    console.log("Payment failed", error);
    return new NextResponse(error, { status: 500 });
  }
}
