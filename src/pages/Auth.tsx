import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import StoreLayout from "@/components/layout/StoreLayout";
import LoginForm from "@/components/auth/LoginForm";
import SignupForm from "@/components/auth/SignupForm";
import { cn } from "@/lib/utils";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      // 1. ?next= query param (explicit redirect)
      // 2. location.state.from (set by AuthGuard when redirecting here)
      // 3. fallback: "/"
      const nextParam = searchParams.get("next");
      const fromState = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      const candidate = nextParam ?? fromState ?? "/";
      const safeNext = candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
      navigate(safeNext, { replace: true });
    }
  }, [user, loading, navigate, searchParams, location.state]);

  return (
    <StoreLayout>
      <div className="pb-20 min-h-screen bg-background">
        <div className="container max-w-md mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="font-display text-3xl lg:text-4xl text-foreground mb-3">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-foreground/60 text-sm">
              {isLogin
                ? "Sign in to access your account and orders"
                : "Join us for exclusive offers and seamless shopping"}
            </p>
          </div>

          {/* Toggle */}
          <div className="flex mb-8 border-b border-border/50">
            <button
              onClick={() => setIsLogin(true)}
              className={cn(
                "flex-1 pb-4 text-xs tracking-widest font-medium transition-colors",
                isLogin
                  ? "text-foreground border-b-2 border-foreground"
                  : "text-foreground/50 hover:text-foreground/70"
              )}
            >
              SIGN IN
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={cn(
                "flex-1 pb-4 text-xs tracking-widest font-medium transition-colors",
                !isLogin
                  ? "text-foreground border-b-2 border-foreground"
                  : "text-foreground/50 hover:text-foreground/70"
              )}
            >
              CREATE ACCOUNT
            </button>
          </div>

          {/* Forms */}
          {isLogin ? <LoginForm /> : <SignupForm />}

          {/* Footer Note */}
          <p className="text-center text-xs text-foreground/50 mt-8">
            By continuing, you agree to our{" "}
            <a href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </StoreLayout>
  );
};

export default Auth;
