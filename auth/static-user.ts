export interface StaticUser {
  sub: string;
  given_name: string;
  family_name: string;
  name: string;
  preferred_username: string;
  email: string;
  email_verified: boolean;
}

export const staticUser: StaticUser = {
  sub: "user_justin_miller",
  given_name: "Justin",
  family_name: "Miller",
  name: "Justin Miller",
  preferred_username: "jmiller",
  email: "jmiller@inifnitedevlab.com",
  email_verified: true,
};
