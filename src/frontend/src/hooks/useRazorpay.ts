import { toast } from "sonner";

const RAZORPAY_KEY_ID = "rzp_test_SZiNYV1U8ukRPI";

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: Razorpay is a third-party global
    Razorpay: any;
  }
}

export interface RazorpayOrderOptions {
  amount: number; // in INR
  productName: string;
  planType: string;
  productId: string;
  userId: string;
  userName: string;
  phone: string;
  /** Called after payment popup confirms success */
  onSuccess?: (planAmount: number) => void;
}

export function useRazorpay() {
  function openRazorpay(options: RazorpayOrderOptions) {
    if (!window.Razorpay) {
      toast.error("Payment gateway not loaded. Please refresh and try again.");
      return;
    }

    const rzpOptions = {
      key: RAZORPAY_KEY_ID,
      amount: options.amount * 100, // paise
      currency: "INR",
      name: "GUCCORA",
      description: options.planType
        ? `${options.productName} - ${options.planType} Plan`
        : options.productName,
      theme: {
        color: "#d4af37",
      },
      // No order_id — not required for test mode simple checkout
      handler: (response: { razorpay_payment_id: string }) => {
        console.log("Payment successful:", response.razorpay_payment_id);

        // Save plan info locally
        localStorage.setItem(
          "plan",
          options.planType || String(options.amount),
        );
        localStorage.setItem("paid", "true");

        // Trigger onSuccess callback (marks user paid in Firestore)
        if (options.onSuccess) {
          options.onSuccess(options.amount);
        }

        toast.success("Payment Successful! Your plan is now active.");
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
