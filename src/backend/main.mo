import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import MixinStorage "blob-storage/Mixin";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Access Control State
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Blob and file storage
  include MixinStorage();

  // User profile storage
  public type UserProfile = {
    name : Text;
    phone : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  // Get the caller's own profile
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    assert AccessControl.hasPermission(accessControlState, caller, #user);
    userProfiles.get(caller);
  };

  // Get any user's profile (own profile or admin viewing others)
  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  // Save the caller's profile
  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    assert AccessControl.hasPermission(accessControlState, caller, #user);
    userProfiles.add(caller, profile);
  };

  // Check if caller is admin
  public query ({ caller }) func isAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };
};
