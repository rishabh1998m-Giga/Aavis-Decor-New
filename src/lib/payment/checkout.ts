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
): Promise<RazorpaySuccessPayload | null> {
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

    if (!verification.success) {
      return null;
    }

    return payment;
  } catch (error) {
    console.error('Payment initiation failed:', error);
    return null;
  }
}

async function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<{ success: boolean }> {
  const response = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, paymentId, signature })
  });
  
  return response.json();
}