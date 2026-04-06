const RAZORPAY_KEY_ID = "rzp_test_SZiNYV1U8ukRPI";

declare global {
  interface Window {
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

/** Dynamically inject Razorpay checkout script if not already loaded */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector(
      'script[src*="checkout.razorpay.com"]',
    );
    if (existing) {
      // Script tag exists but Razorpay object not yet available — wait for load
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Razorpay script load error")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay script failed to load"));
    document.head.appendChild(script);
  });
}

export function useRazorpay() {
  async function openRazorpay(options: RazorpayOrderOptions) {
    console.log(
      "[Razorpay] Initiating payment for:",
      options.productName,
      `₹${options.amount}`,
    );

    // Ensure script is loaded before opening popup
    try {
      await loadRazorpayScript();
    } catch (err) {
      console.error("[Razorpay] Script load failed:", err);
      alert(
        "Payment gateway not loaded. Please check your internet connection and try again.",
      );
      return;
    }

    if (!window.Razorpay) {
      console.error(
        "[Razorpay] window.Razorpay is undefined after script load",
      );
      alert("Payment gateway not available. Please refresh the page.");
      return;
    }

    const rzpOptions = {
      key: RAZORPAY_KEY_ID,
      amount: Math.round(options.amount * 100), // paise — must be integer
      currency: "INR",
      name: "GUCCORA",
      description: options.productName,
      // NO order_id — not needed for test mode simple checkout
      // NO backend calls — pure frontend checkout
      theme: {
        color: "#d4af37",
      },
      handler: (response: { razorpay_payment_id: string }) => {
        console.log(
          "[Razorpay] Payment SUCCESS. Payment ID:",
          response.razorpay_payment_id,
        );

        // Store locally
        localStorage.setItem(
          "plan",
          options.planType || String(options.amount),
        );
        localStorage.setItem("paid", "true");

        // Trigger app callback
        if (options.onSuccess) {
          options.onSuccess(options.amount);
        }

        alert("Payment Successful! Your plan is now active.");
      },
      prefill: {
        name: options.userName || "",
        contact: options.phone || "",
      },
      modal: {
        ondismiss: () => {
          console.log("[Razorpay] Modal dismissed by user");
        },
        escape: true,
        animation: true,
      },
    };

    console.log("[Razorpay] Opening checkout with options:", {
      key: rzpOptions.key,
      amount: rzpOptions.amount,
      currency: rzpOptions.currency,
      name: rzpOptions.name,
    });

    let rzp: any;
    try {
      rzp = new window.Razorpay(rzpOptions);
    } catch (err) {
      console.error("[Razorpay] Failed to create Razorpay instance:", err);
      alert("Failed to initialize payment. Please refresh and try again.");
      return;
    }

    rzp.on("payment.failed", (resp: any) => {
      console.error("[Razorpay] Payment FAILED:", resp);
      console.error("[Razorpay] Error code:", resp?.error?.code);
      console.error("[Razorpay] Error description:", resp?.error?.description);
      console.error("[Razorpay] Error source:", resp?.error?.source);
      console.error("[Razorpay] Error step:", resp?.error?.step);
      console.error("[Razorpay] Error reason:", resp?.error?.reason);
      console.error("[Razorpay] Metadata:", resp?.error?.metadata);

      const reason =
        resp?.error?.description ||
        resp?.error?.reason ||
        "Payment failed. Please try again.";
      alert(`Payment failed: ${reason}`);
    });

    rzp.open();
    console.log("[Razorpay] rzp.open() called — popup should be visible");
  }

  return { openRazorpay };
}
