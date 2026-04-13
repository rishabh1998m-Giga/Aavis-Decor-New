import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import StoreLayout from "@/components/layout/StoreLayout";
import PageMeta from "@/components/seo/PageMeta";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiJson, friendlyError } from "@/lib/api";
import { formatPrice } from "@/lib/formatters";
import { initiatePayment } from "@/lib/payment/checkout";
import { addressSchema, type AddressFormValues, indianStates } from "@/lib/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ChevronRight, Loader2, CreditCard, Banknote, CheckCircle, Tag, X, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Step = "address" | "payment" | "review";

const Checkout = () => {
  const { items, subtotal, clearCart, embeddedGstTotal } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("address");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [addressData, setAddressData] = useState<AddressFormValues | null>(null);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
    type: string;
    value: number;
  } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState("");

  const shippingCost = subtotal >= 999 ? 0 : 99;
  const codFee = paymentMethod === "cod" ? 49 : 0;
  const discountAmount = appliedDiscount?.amount || 0;
  const gstAmount = embeddedGstTotal;
  const total = subtotal - discountAmount + shippingCost + codFee;

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      fullName: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", pincode: "",
    },
  });

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountLoading(true);
    setDiscountError("");

    try {
      const data = await apiJson<
        | { valid: true; code: string; discountAmount: number; type: string; value: number }
        | { valid: false; error?: string }
      >("/api/checkout/validate-discount", {
        method: "POST",
        body: JSON.stringify({ code: discountCode.trim(), cartTotal: subtotal }),
      });

      if (!data.valid) {
        setDiscountError(data.error || "Invalid code");
        return;
      }

      setAppliedDiscount({
        code: data.code,
        amount: data.discountAmount,
        type: data.type,
        value: data.value,
      });
      toast({ title: "Discount applied!", description: `You save ${formatPrice(data.discountAmount)}` });
    } catch (e) {
      setDiscountError(friendlyError(e, "Failed to validate code"));
    } finally {
      setDiscountLoading(false);
    }
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode("");
    setDiscountError("");
  };

  const handleAddressSubmit = (values: AddressFormValues) => {
    setAddressData(values);
    setCurrentStep("payment");
  };

  const handlePlaceOrder = async () => {
    if (!addressData || items.length === 0) return;
    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to place an order.",
        variant: "destructive",
      });
      return;
    }
    setIsPlacingOrder(true);

    const shippingAddress = {
      full_name: addressData.fullName,
      phone: addressData.phone,
      address_line1: addressData.addressLine1,
      address_line2: addressData.addressLine2 || "",
      city: addressData.city,
      state: addressData.state,
      pincode: addressData.pincode,
    };

    const cartItems = items.map((i) => ({
      variantId: i.variantId,
      productId: i.productId,
      quantity: i.quantity,
      ...(i.customCurtainSize?.trim()
        ? { customCurtainSize: i.customCurtainSize.trim().slice(0, 200) }
        : {}),
    }));

    try {
      if (paymentMethod === "upi") {
        const rzpOrder = await apiJson<{
          razorpay_order_id: string;
          amount_paise: number;
          currency: string;
          key_id: string;
          db_order_id: string;
          order_number: string;
        }>("/api/checkout/razorpay/create-order", {
          method: "POST",
          body: JSON.stringify({
            items: cartItems,
            shippingAddress,
            discountCode: appliedDiscount?.code || undefined,
          }),
        });

        const paymentSuccess = await initiatePayment(
          rzpOrder.amount_paise / 100,
          rzpOrder.order_number,
          addressData.fullName
        );
        
        if (!paymentSuccess) {
          toast({ title: "Payment failed", description: "Please try again." });
          return;
        }

        const data = await apiJson<{
          orderId: string;
          orderNumber: string;
          totalAmount: number;
        }>("/api/orders/confirm", {
          method: "POST",
          body: JSON.stringify({
            orderId: rzpOrder.db_order_id,
            paymentId: "DUMMY_PAYMENT_ID", // Will be replaced after actual payment
          }),
        });

        clearCart();
        toast({ title: "Payment successful!", description: `Order #${data.orderNumber}` });
        navigate(`/order-confirmation/${data.orderNumber}`);
      } else {
        const data = await apiJson<{
          orderId: string;
          orderNumber: string;
          totalAmount: number;
          discountAmount: number;
        }>("/api/checkout/orders", {
          method: "POST",
          body: JSON.stringify({
            items: cartItems,
            shippingAddress,
            paymentMethod,
            discountCode: appliedDiscount?.code || undefined,
          }),
        });

        clearCart();
        toast({ title: "Order placed successfully!", description: `Order #${data.orderNumber}` });
        navigate(`/order-confirmation/${data.orderNumber}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Payment cancelled") {
        toast({ title: "Payment cancelled", description: "Your order was not placed." });
        return;
      }
      toast({
        title: "Failed to place order",
        description: friendlyError(error),
        variant: "destructive",
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (items.length === 0) {
    return (
      <StoreLayout>
        <PageMeta title="Checkout" description="Complete your Aavis Decor order." canonical="/checkout" noIndex />
        <div className="pb-20 min-h-screen container max-w-lg text-center">
          <h1 className="font-display text-2xl mb-4">Your bag is empty</h1>
          <Button asChild><Link to="/">Continue Shopping</Link></Button>
        </div>
      </StoreLayout>
    );
  }

  // Wait for session hydration — don't flash sign-in gate while auth resolves.
  if (authLoading) {
    return (
      <StoreLayout>
        <PageMeta title="Checkout" description="Complete your Aavis Decor order." canonical="/checkout" noIndex />
        <div className="pb-20 min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-foreground/40" />
        </div>
      </StoreLayout>
    );
  }

  // Gate on auth BEFORE showing the 3-step flow. Previously we let customers
  // fill the whole form and only blocked them at "Pay Now" — bad UX.
  if (!user) {
    return (
      <StoreLayout>
        <PageMeta title="Checkout" description="Sign in to complete your Aavis Decor order." canonical="/checkout" noIndex />
        <div className="pb-20 min-h-screen">
          <div className="container max-w-md">
            <div className="border border-border/30 rounded-md p-8 text-center">
              <h1 className="font-display text-2xl mb-3">Sign in to continue</h1>
              <p className="text-sm text-foreground/60 mb-6">
                You need an account to place an order. Your bag will be kept safe while you sign in.
              </p>
              <Button
                asChild
                className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 text-xs tracking-widest mb-3"
              >
                <Link to="/auth?next=/checkout">SIGN IN OR CREATE ACCOUNT</Link>
              </Button>
              <Button asChild variant="outline" className="w-full text-xs tracking-widest">
                <Link to="/cart">BACK TO BAG</Link>
              </Button>
            </div>
          </div>
        </div>
      </StoreLayout>
    );
  }

  const steps: { key: Step; label: string }[] = [
    { key: "address", label: "Address" },
    { key: "payment", label: "Payment" },
    { key: "review", label: "Review" },
  ];
  const currentStepIdx = steps.findIndex((s) => s.key === currentStep);

  const OrderSummary = (
    <div className="border border-border/30 rounded-md p-6 space-y-4">
      <h3 className="font-display text-lg">Order Summary</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-foreground/70">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-foreground/70">Shipping</span><span>{shippingCost === 0 ? <span className="text-green-600">FREE</span> : formatPrice(shippingCost)}</span></div>
        <div className="flex justify-between"><span className="text-foreground/70">GST (included)</span><span>{formatPrice(gstAmount)}</span></div>
        {codFee > 0 && <div className="flex justify-between"><span className="text-foreground/70">COD Fee</span><span>{formatPrice(codFee)}</span></div>}
        {discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount ({appliedDiscount?.code})</span>
            <span>-{formatPrice(discountAmount)}</span>
          </div>
        )}
      </div>
      <div className="border-t border-border/30 pt-3">
        <div className="flex justify-between text-lg font-medium"><span>Total</span><span>{formatPrice(total)}</span></div>
      </div>

      <div className="border-t border-border/30 pt-4">
        <h4 className="text-xs tracking-widest text-foreground/70 mb-3">DISCOUNT CODE</h4>
        {appliedDiscount ? (
          <div className="flex items-center justify-between bg-green-50 p-3 rounded-md">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-green-600" aria-hidden />
              <span className="text-sm font-medium text-green-600">{appliedDiscount.code}</span>
            </div>
            <button onClick={removeDiscount} aria-label={`Remove discount code ${appliedDiscount.code}`}>
              <X className="h-4 w-4 text-foreground/50" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="h-10 text-sm"
              aria-label="Discount code"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyDiscount}
              disabled={discountLoading || !discountCode.trim()}
              className="h-10 px-4"
            >
              {discountLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden /> Checking</>
              ) : (
                "Apply"
              )}
            </Button>
          </div>
        )}
        {discountError && <p className="text-xs text-red-500 mt-2">{discountError}</p>}
      </div>
    </div>
  );

  return (
    <StoreLayout>
      <PageMeta title="Checkout" description="Complete your Aavis Decor order. Secure checkout with COD or UPI." canonical="/checkout" noIndex />
      <div className="pb-28 lg:pb-20">
        <div className="container max-w-4xl">
          {/* Desktop step indicator */}
          <div className="hidden md:flex items-center justify-center gap-4 mb-10">
            {steps.map((step, i) => (
              <div key={step.key} className="flex items-center gap-4">
                <button
                  onClick={() => {
                    if (step.key === "address") setCurrentStep("address");
                    if (step.key === "payment" && addressData) setCurrentStep("payment");
                    if (step.key === "review" && addressData) setCurrentStep("review");
                  }}
                  className={cn(
                    "flex items-center gap-2 text-xs tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 rounded-sm",
                    currentStep === step.key ? "text-foreground font-medium" : "text-foreground/40"
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px]",
                    currentStep === step.key ? "bg-foreground text-background" : "border border-foreground/30"
                  )}>
                    {i + 1}
                  </span>
                  {step.label.toUpperCase()}
                </button>
                {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-foreground/20" aria-hidden />}
              </div>
            ))}
          </div>

          {/* Mobile step indicator */}
          <div className="md:hidden mb-6">
            <div className="flex items-center justify-between text-xs tracking-widest text-foreground/70 mb-2">
              <span>STEP {currentStepIdx + 1} OF {steps.length}</span>
              <span className="text-foreground font-medium">{steps[currentStepIdx].label.toUpperCase()}</span>
            </div>
            <div className="h-1 bg-foreground/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground transition-all"
                style={{ width: `${((currentStepIdx + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-10">
            <div className="lg:col-span-3">
              {currentStep === "address" && (
                <div>
                  <h2 className="font-display text-xl mb-6">Shipping Address</h2>
                  {!user && (
                    <p className="text-sm text-foreground/60 mb-6">
                      <Link to="/auth" className="underline">Sign in</Link> for a faster checkout experience
                    </p>
                  )}
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleAddressSubmit)} className="space-y-4">
                      <FormField control={form.control} name="fullName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest text-foreground/70">FULL NAME</FormLabel>
                          <FormControl><Input className="h-11" autoComplete="name" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest text-foreground/70">MOBILE NUMBER</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground/50">+91</span>
                              <Input className="h-11 pl-12" maxLength={10} inputMode="numeric" autoComplete="tel-national" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="addressLine1" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest text-foreground/70">ADDRESS LINE 1</FormLabel>
                          <FormControl><Input className="h-11" placeholder="House/Flat No., Building" autoComplete="address-line1" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="addressLine2" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest text-foreground/70">ADDRESS LINE 2 (OPTIONAL)</FormLabel>
                          <FormControl><Input className="h-11" placeholder="Street, Landmark" autoComplete="address-line2" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="city" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs tracking-widest text-foreground/70">CITY</FormLabel>
                            <FormControl><Input className="h-11" autoComplete="address-level2" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="pincode" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs tracking-widest text-foreground/70">PINCODE</FormLabel>
                            <FormControl><Input className="h-11" maxLength={6} inputMode="numeric" autoComplete="postal-code" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="state" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest text-foreground/70">STATE</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11"><SelectValue placeholder="Select state" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {indianStates.map((state) => (
                                <SelectItem key={state} value={state}>{state}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 text-xs tracking-widest">
                        CONTINUE TO PAYMENT
                      </Button>
                    </form>
                  </Form>
                </div>
              )}

              {currentStep === "payment" && (
                <div>
                  <h2 className="font-display text-xl mb-6">Payment Method</h2>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                    <div className={cn("flex items-center gap-4 p-4 border rounded-md cursor-pointer", paymentMethod === "cod" ? "border-foreground" : "border-border/50")}>
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="cursor-pointer flex-1">
                        <div className="flex items-center gap-3">
                          <Banknote className="h-5 w-5 text-foreground/60" aria-hidden />
                          <div>
                            <p className="font-medium text-sm">Cash on Delivery</p>
                            <p className="text-xs text-foreground/50">Pay when your order arrives (+₹49 COD fee)</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                    <div className={cn("flex items-center gap-4 p-4 border rounded-md cursor-pointer", paymentMethod === "upi" ? "border-foreground" : "border-border/50")}>
                      <RadioGroupItem value="upi" id="upi" />
                      <Label htmlFor="upi" className="cursor-pointer flex-1">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-5 w-5 text-foreground/60" aria-hidden />
                          <div>
                            <p className="font-medium text-sm">UPI / Card / Net Banking</p>
                            <p className="text-xs text-foreground/50">Pay securely via Razorpay</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                  <div className="flex gap-4 mt-8">
                    <Button variant="outline" onClick={() => setCurrentStep("address")} className="flex-1 h-12 text-xs tracking-widest">
                      BACK
                    </Button>
                    <Button onClick={() => setCurrentStep("review")} className="flex-1 h-12 bg-foreground text-background hover:bg-foreground/90 text-xs tracking-widest">
                      REVIEW ORDER
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === "review" && addressData && (
                <div>
                  <h2 className="font-display text-xl mb-6">Review Your Order</h2>
                  <div className="border border-border/30 rounded-md p-4 mb-6">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xs tracking-widest text-foreground/70 mb-2">SHIPPING ADDRESS</h3>
                      <button onClick={() => setCurrentStep("address")} className="text-xs underline text-foreground/60">Edit</button>
                    </div>
                    <p className="text-sm">{addressData.fullName}</p>
                    <p className="text-sm text-foreground/70">{addressData.addressLine1}</p>
                    {addressData.addressLine2 && <p className="text-sm text-foreground/70">{addressData.addressLine2}</p>}
                    <p className="text-sm text-foreground/70">{addressData.city}, {addressData.state} - {addressData.pincode}</p>
                    <p className="text-sm text-foreground/70">+91 {addressData.phone}</p>
                  </div>
                  <div className="border border-border/30 rounded-md p-4 mb-6">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xs tracking-widest text-foreground/70 mb-2">PAYMENT METHOD</h3>
                      <button onClick={() => setCurrentStep("payment")} className="text-xs underline text-foreground/60">Edit</button>
                    </div>
                    <p className="text-sm">{paymentMethod === "cod" ? "Cash on Delivery" : "UPI / Card / Net Banking"}</p>
                  </div>
                  <div className="border border-border/30 rounded-md p-4 mb-6">
                    <h3 className="text-xs tracking-widest text-foreground/70 mb-4">ORDER ITEMS ({items.length})</h3>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div key={item.lineId} className="flex gap-3">
                          <img src={item.imageUrl} alt={item.name} className="w-14 h-18 object-cover" loading="lazy" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-foreground/50">{item.variantInfo} × {item.quantity}</p>
                          </div>
                          <p className="text-sm font-medium">{formatPrice(item.price * item.quantity)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handlePlaceOrder}
                    disabled={isPlacingOrder}
                    className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 text-xs tracking-widest"
                  >
                    {isPlacingOrder ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> {paymentMethod === "upi" ? "OPENING PAYMENT..." : "PLACING ORDER..."}</>
                    ) : (
                      <><CheckCircle className="mr-2 h-4 w-4" aria-hidden /> {paymentMethod === "upi" ? "PAY NOW" : "PLACE ORDER"} — {formatPrice(total)}</>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Desktop summary column */}
            <div className="hidden lg:block lg:col-span-2">
              <div className="sticky" style={{ top: "calc(var(--header-h, 120px) + 1rem)" }}>
                {OrderSummary}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile summary drawer (fixed bottom bar) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => setMobileSummaryOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm"
          aria-expanded={mobileSummaryOpen}
          aria-label={mobileSummaryOpen ? "Hide order summary" : "Show order summary"}
        >
          <div className="flex items-center gap-2">
            <ChevronUp
              className={cn("h-4 w-4 transition-transform", mobileSummaryOpen && "rotate-180")}
              aria-hidden
            />
            <span className="text-foreground/70">Order total</span>
          </div>
          <span className="font-medium">{formatPrice(total)}</span>
        </button>
        {mobileSummaryOpen && (
          <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
            {OrderSummary}
          </div>
        )}
      </div>

      {/* Full-screen loading overlay during order placement — prevents double-submit */}
      {isPlacingOrder && (
        <div className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-background border border-border/50 rounded-md px-6 py-4 shadow-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-foreground" aria-hidden />
            <p className="text-sm">
              {paymentMethod === "upi" ? "Connecting to Razorpay…" : "Placing your order…"}
            </p>
          </div>
        </div>
      )}
    </StoreLayout>
  );
};

export default Checkout;
