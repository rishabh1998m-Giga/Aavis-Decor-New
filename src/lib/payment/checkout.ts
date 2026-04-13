import { openRazorpay, type RazorpaySuccessPayload } from '@/lib/razorpay';

interface InitiatePaymentParams {
  amountPaise: number;
  currency: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  orderNumber: string;
  customerName: string;
}

export async function initiatePayment(
  params: InitiatePaymentParams
): Promise<VerifyPaymentResponse | null> {
  try {
    const payment = await openRazorpay({
      key: params.razorpayKeyId,
      amount: params.amountPaise,
      currency: params.currency,
      name: 'Aavis Decor',
      description: `Order #${params.orderNumber}`,
      order_id: params.razorpayOrderId,
      prefill: {
        name: params.customerName,
      },
      theme: {
        color: '#6366f1',
      },
    });

    const verification = await verifyPaymentSignature(
      payment.razorpay_order_id,
      payment.razorpay_payment_id,
      payment.razorpay_signature
    );

    return verification;
  } catch (error) {
    console.error('Payment initiation failed:', error);
    return null;
  }
}

interface VerifyPaymentResponse {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
}

async function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<VerifyPaymentResponse> {
  const response = await fetch('/api/checkout/razorpay/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || 'Payment verification failed');
  }

  return response.json() as Promise<VerifyPaymentResponse>;
}