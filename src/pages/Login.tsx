import { AuthPanel } from "../components/AuthPanel";

export function Login() {
  return (
    <div className="page page-login">
      <h1>Where I'm Going</h1>
      <p>Sign in to track your upcoming trips and, if you want, share where you'll be.</p>
      <AuthPanel />
    </div>
  );
}
