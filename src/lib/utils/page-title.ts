export const getTitleFromPathname = (pathname: string) => {
  switch (pathname) {
    case "/calendar":
      return "Calendar | GoneSquirrel";
    case "/tasks":
      return "Tasks | GoneSquirrel";
    case "/focus":
      return "Now | GoneSquirrel";
    case "/settings":
      return "Settings | GoneSquirrel";
    case "/setup":
      return "Setup | GoneSquirrel";
    case "/auth/signin":
      return "Sign In | GoneSquirrel";
    case "/auth/signup":
      return "Sign Up | GoneSquirrel";
    case "/auth/reset-password":
      return "Reset Password | GoneSquirrel";
    default:
      return "GoneSquirrel";
  }
};
