export type AppPage =
  | "dashboard"
  | "plans"
  | "wallet"
  | "team"
  | "kyc"
  | "orders"
  | "notifications"
  | "profile"
  | "admin";

export type Page = AppPage | "home" | "profile-setup";
