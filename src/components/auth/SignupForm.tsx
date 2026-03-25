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
} from "@/lib/firebaseAuthForm";
import { Loader2 } from "lucide-react";

const signupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

const SignupForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    const blocked = authFormBlockedMessage();
    if (blocked) {
      toast({
        title: "Signup unavailable",
        description: blocked,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(values.email, values.password, values.fullName);
    setIsLoading(false);

    if (error) {
      toast({
        title: "Signup failed",
        description: authExceptionMessage(error),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Account created!",
      description: "Please check your email to verify your account before signing in.",
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs tracking-widest text-foreground/70">
                FULL NAME
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Your Name"
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

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs tracking-widest text-foreground/70">
                CONFIRM PASSWORD
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
              CREATING ACCOUNT...
            </>
          ) : (
            "CREATE ACCOUNT"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default SignupForm;
