interface ShiprocketAuth {
  email: string;
  password: string;
}

interface CreateOrderPayload {
  order_id: string;
  order_date: string;
  pickup_location: string;
  billing_customer_name: string;
  billing_last_name: string;
  billing_address: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  order_items: Array<{
    name: string;
    sku: string;
    units: number;
    selling_price: number;
    discount: string;
    tax: string;
    hsn: string;
  }>;
  payment_method: string;
  shipping_charges: number;
  total_discount: number;
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

class ShiprocketClient {
  private token: string | null = null;
  private readonly baseUrl = 'https://apiv2.shiprocket.in/v1/external';

  async authenticate(credentials: ShiprocketAuth): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error('Shiprocket authentication failed');
    }

    const data = await response.json();
    this.token = data.token;
  }

  async createOrder(payload: CreateOrderPayload) {
    if (!this.token) {
      throw new Error('Not authenticated with Shiprocket');
    }

    const response = await fetch(`${this.baseUrl}/orders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Shiprocket order creation failed: ${error.message}`);
    }

    return response.json();
  }
}

export default ShiprocketClient;