import { Router } from 'express';
import crypto from 'crypto';
import ShiprocketClient from '../../src/lib/shipping/shiprocket';

const router = Router();

// Verify Razorpay payment signature
router.post('/payments/verify', async (req, res) => {
  const { orderId, paymentId, signature } = req.body;

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      success: false,
      error: 'Missing required payment verification fields.'
    });
  }

  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!razorpaySecret) {
    return res.status(500).json({
      success: false,
      error: 'Payment verification is not configured.'
    });
  }

  const expectedSignature = crypto
    .createHmac('sha256', razorpaySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signature);

  if (expectedSignatureBuffer.length !== signatureBuffer.length) {
    return res.status(401).json({ success: false, error: 'Invalid payment signature.' });
  }

  const isSignatureValid = crypto.timingSafeEqual(expectedSignatureBuffer, signatureBuffer);

  if (!isSignatureValid) {
    return res.status(401).json({ success: false, error: 'Invalid payment signature.' });
  }

  return res.json({ success: true });
});

// Confirm order and sync to Shiprocket
router.post('/orders/confirm', async (req, res) => {
  const { orderId, paymentId } = req.body;
  
  try {
    // 1. Authenticate with Shiprocket
    const shiprocket = new ShiprocketClient();
    await shiprocket.authenticate({
      email: process.env.SHIPROCKET_EMAIL!,
      password: process.env.SHIPROCKET_PASSWORD!
    });

    // 2. Prepare order payload (mock data - replace with real order details)
    const orderPayload = {
      order_id: orderId,
      order_date: new Date().toISOString().split('T')[0],
      pickup_location: 'Primary',
      billing_customer_name: 'Aman Bhogal',
      billing_last_name: '',
      billing_address: '123 Decor Street',
      billing_city: 'Mumbai',
      billing_pincode: '400001',
      billing_state: 'Maharashtra',
      billing_country: 'India',
      billing_email: 'amanbhogal.work@gmail.com',
      billing_phone: '9876543210',
      shipping_is_billing: true,
      order_items: [
        {
          name: 'Premium Curtain Set',
          sku: 'CURT-001',
          units: 1,
          selling_price: 2500,
          discount: '0',
          tax: '0',
          hsn: '5208'
        }
      ],
      payment_method: 'Prepaid',
      shipping_charges: 0,
      total_discount: 0,
      sub_total: 2500,
      length: 30,
      breadth: 20,
      height: 5,
      weight: 1.5
    };

    // 3. Create Shiprocket order
    const shiprocketResponse = await shiprocket.createOrder(orderPayload);
    
    console.log('Shiprocket order created:', shiprocketResponse);
    res.json({ success: true, shiprocketOrderId: shiprocketResponse.id });
    
  } catch (error) {
    console.error('Order confirmation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;