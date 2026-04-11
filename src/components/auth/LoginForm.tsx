import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  authFormBlockedMessage,
  authExceptionMessage,
} from "@/lib/apiAuthForm";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    const blocked = authFormBlockedMessage();
    if (blocked) {
      toast({
        title: "Sign in unavailable",
        description: blocked,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(values.email, values.password);
    setIsLoading(false);

    if (error) {
      toast({
        title: "Login failed",
        description: authExceptionMessage(error),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Welcome back!",
      description: "You have successfully logged in.",
    });
    // Redirect handled by Auth.tsx useEffect — reads ?next= param.
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs tracking-widest text-foreground/70">
                EMAIL ADDRESS
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="your@email.com"
                  type="email"
                  className="h-12 border-border/50 bg-background focus:border-foreground"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs tracking-widest text-foreground/70">
                PASSWORD
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="••••••••"
                  type="password"
                  className="h-12 border-border/50 bg-background focus:border-foreground"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 text-xs tracking-widest"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              SIGNING IN...
            </>
          ) : (
            "SIGN IN"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default LoginForm;
