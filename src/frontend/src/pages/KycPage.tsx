import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Clock, ShieldCheck, Upload, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useGuccora } from "../context/GuccoraContext";

export function KycPage() {
  const { userData, submitKyc } = useGuccora();
  const [aadharFront, setAadharFront] = useState("");
  const [aadharBack, setAadharBack] = useState("");
  const [pan, setPan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleFile(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setter(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!aadharFront || !aadharBack || !pan) {
      toast.error("Please upload all required documents");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    submitKyc(aadharFront, aadharBack, pan);
    toast.success("KYC submitted! Under review.");
    setSubmitting(false);
  }

  const { kycStatus } = userData;

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-fade-in">
      <h1 className="text-white font-black font-display text-2xl mb-1">
        KYC Verification
      </h1>
      <p className="text-[#606060] text-sm mb-5">Required for withdrawals</p>

      {/* Status Banner */}
      {kycStatus === "approved" && (
        <div
          className="flex items-center gap-3 rounded-xl p-4 border border-green-500/20 mb-6"
          style={{ background: "#0a1a0a" }}
          data-ocid="kyc.status.success_state"
        >
          <CheckCircle size={24} className="text-green-400" />
          <div>
            <p className="text-green-400 font-bold">KYC Approved</p>
            <p className="text-[#606060] text-xs">
              You can now withdraw funds.
            </p>
          </div>
        </div>
      )}

      {kycStatus === "pending" && (
        <div
          className="flex items-center gap-3 rounded-xl p-4 border border-yellow-500/20 mb-6"
          style={{ background: "#1a1500" }}
          data-ocid="kyc.status.loading_state"
        >
          <Clock size={24} className="text-yellow-400" />
          <div>
            <p className="text-yellow-400 font-bold">Under Review</p>
            <p className="text-[#606060] text-xs">
              Documents submitted. Admin will verify within 24 hours.
            </p>
          </div>
        </div>
      )}

      {kycStatus === "rejected" && (
        <div
          className="rounded-xl p-4 border border-red-500/20 mb-6"
          style={{ background: "#1a0a0a" }}
          data-ocid="kyc.status.error_state"
        >
          <div className="flex items-center gap-3 mb-1">
            <XCircle size={24} className="text-red-400" />
            <p className="text-red-400 font-bold">KYC Rejected</p>
          </div>
          {userData.kycRejectionReason && (
            <p className="text-[#808080] text-xs ml-9">
              Reason: {userData.kycRejectionReason}
            </p>
          )}
          <p className="text-[#606060] text-xs ml-9">Please resubmit below.</p>
        </div>
      )}

      {(kycStatus === "none" || kycStatus === "rejected") && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
          data-ocid="kyc.form.panel"
        >
          {/* Info */}
          <div
            className="flex items-center gap-3 rounded-xl p-3 border border-gold/10"
            style={{ background: "#141414" }}
          >
            <ShieldCheck size={20} className="text-gold" />
            <p className="text-[#A0A0A0] text-xs">
              Your documents are encrypted and stored securely. Required only
              for identity verification.
            </p>
          </div>

          {[
            {
              label: "Aadhar Card — Front",
              state: aadharFront,
              setter: setAadharFront,
              ocid: "kyc.aadhar_front.upload_button",
            },
            {
              label: "Aadhar Card — Back",
              state: aadharBack,
              setter: setAadharBack,
              ocid: "kyc.aadhar_back.upload_button",
            },
            {
              label: "PAN Card",
              state: pan,
              setter: setPan,
              ocid: "kyc.pan.upload_button",
            },
          ].map(({ label, state, setter, ocid }) => (
            <div key={label} className="space-y-2">
              <Label className="text-[#A0A0A0] text-sm">{label}</Label>
              <label
                className="flex items-center gap-3 cursor-pointer rounded-xl p-4 border border-dashed border-gold/20 hover:border-gold/40 transition-colors"
                style={{ background: "#141414" }}
                data-ocid={ocid}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile(e, setter)}
                  className="hidden"
                />
                {state ? (
                  <>
                    <img
                      src={state}
                      alt={label}
                      className="w-16 h-12 object-cover rounded-lg border border-gold/20"
                    />
                    <div>
                      <p className="text-green-400 text-sm font-semibold flex items-center gap-1">
                        <CheckCircle size={14} /> Uploaded
                      </p>
                      <p className="text-[#606060] text-xs">Tap to change</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-10 rounded-lg border border-dashed border-gold/30 flex items-center justify-center">
                      <Upload size={18} className="text-gold/50" />
                    </div>
                    <div>
                      <p className="text-[#808080] text-sm">Tap to upload</p>
                      <p className="text-[#505050] text-xs">JPG, PNG, PDF</p>
                    </div>
                  </>
                )}
              </label>
            </div>
          ))}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-gold hover:bg-gold-light text-black font-black h-11 rounded-xl"
            data-ocid="kyc.submit.primary_button"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                Submitting...
              </span>
            ) : (
              "Submit KYC Documents"
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
