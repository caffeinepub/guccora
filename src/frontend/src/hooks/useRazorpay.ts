import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { db, isFirebaseConfigured } from "../firebase";

const RAZORPAY_KEY_ID = "rzp_test_SZiNYV1U8ukRPI";

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: Razorpay is a third-party global
    Razorpay: any;
  }
}

export interface RazorpayOrderOptions {
  amount: number; // in INR (will be converted to paise internally)
  productName: string;
  planType: string;
  productId: string;
  userId: string;
  userName: string;
  phone: string;
  /** Called after payment is confirmed successful and order saved to Firestore */
  onSuccess?: (planAmount: number) => void;
}

export function useRazorpay() {
  async function openRazorpay(options: RazorpayOrderOptions) {
    if (!window.Razorpay) {
      toast.error("Payment gateway not loaded. Please refresh and try again.");
      return;
    }

    // Amount must be in paise (INR * 100), must be integer
    const amountInPaise = Math.round(options.amount * 100);

    const rzpOptions = {
      key: RAZORPAY_KEY_ID,
      amount: amountInPaise,
      currency: "INR",
      name: "GUCCORA",
      description: options.planType
        ? `${options.productName} - ${options.planType} Plan`
        : options.productName,
      prefill: {
        name: options.userName,
        contact: options.phone,
      },
      theme: {
        color: "#d4af37",
      },
      // NOTE: order_id is intentionally omitted.
      // Creating a Razorpay order requires the secret key on a backend server.
      // Without order_id, Razorpay runs in "standard checkout" mode which is
      // fully valid for test mode and does not require a server.
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id?: string;
        razorpay_signature?: string;
      }) => {
        const paymentId = response.razorpay_payment_id;

        try {
          if (isFirebaseConfigured) {
            // Save order to Firestore with status "pending" for admin approval
            await addDoc(collection(db, "orders"), {
              userId: options.userId,
              userName: options.userName,
              phone: options.phone,
              productId: options.productId,
              productName: options.productName,
              planType: options.planType,
              amount: options.amount,
              status: "pending",
              isAmountAdded: false,
              paymentMethod: "razorpay",
              razorpayPaymentId: paymentId,
              createdAt: serverTimestamp(),
            });
          }

          // Trigger onSuccess callback (marks user as paid + credits referrer)
          if (options.onSuccess) {
            options.onSuccess(options.amount);
          }

          toast.success(
            "Payment successful! ✅ Your order has been placed and is awaiting admin approval.",
          );
        } catch (err) {
          console.error("Order save error after payment:", err);
          // Still call onSuccess so user is marked paid even if order save fails
          if (options.onSuccess) {
            options.onSuccess(options.amount);
          }
          toast.warning(
            `Payment received but order save failed. Payment ID: ${paymentId}`,
          );
        }
      },
      modal: {
        ondismiss: () => {
          toast.info("Payment cancelled.");
        },
      },
    };

    const rzp = new window.Razorpay(rzpOptions);

    rzp.on("payment.failed", (resp: { error: { description: string } }) => {
      const reason = resp?.error?.description || "Payment failed.";
      toast.error(`Payment failed: ${reason}`);
    });

    rzp.open();
  }

  return { openRazorpay };
}
