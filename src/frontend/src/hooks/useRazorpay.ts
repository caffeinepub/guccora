import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
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
      description: `${options.productName} - ${options.planType} Plan`,
      prefill: {
        name: options.userName,
        contact: options.phone,
      },
      theme: {
        color: "#FFD700",
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
            // 1. Save order to Firestore
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

            // 2. Update user wallet in Firestore
            if (options.userId) {
              await updateDoc(doc(db, "users", options.userId), {
                wallet: increment(options.amount),
              });
            }
          }

          // 3. Fallback: also save to localStorage for admin panel
          try {
            const existing = JSON.parse(localStorage.getItem("orders") || "[]");
            existing.unshift({
              id: paymentId,
              userId: options.userId,
              userName: options.userName,
              phone: options.phone,
              productName: options.productName,
              planType: options.planType,
              amount: options.amount,
              status: "pending",
              isAmountAdded: false,
              paymentMethod: "razorpay",
              razorpayPaymentId: paymentId,
              date: new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
            });
            localStorage.setItem("orders", JSON.stringify(existing));
          } catch {
            // ignore localStorage errors
          }

          toast.success("Payment successful! Your order has been placed.");
        } catch (err) {
          console.error("Order save error after payment:", err);
          toast.error(
            `Payment received but order save failed. Share payment ID with support: ${paymentId}`,
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
