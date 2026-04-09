/**
 * Stripe Payment Processor Tests
 */

import { StripePaymentProcessor } from '../src/core/payments/stripeProcessor';
import { StripeManus } from '../src/core/payments';

describe('StripePaymentProcessor', () => {
  let processor: StripePaymentProcessor;

  beforeEach(() => {
    processor = new StripePaymentProcessor();
  });

  describe('Customer Management', () => {
    test('should create a customer', async () => {
      const customer = await processor.createCustomer({
        email: 'test@example.com',
        name: 'John Doe',
      });

      expect(customer.customerId).toBeDefined();
      expect(customer.email).toBe('test@example.com');
      expect(customer.name).toBe('John Doe');
      expect(customer.paymentMethods).toEqual([]);
      expect(customer.subscriptions).toEqual([]);
    });

    test('should retrieve a customer', async () => {
      const created = await processor.createCustomer({
        email: 'retrieve@example.com',
        name: 'Jane Doe',
      });

      const retrieved = await processor.getCustomer(created.customerId);
      expect(retrieved).toEqual(created);
    });

    test('should update a customer', async () => {
      const customer = await processor.createCustomer({
        email: 'update@example.com',
        name: 'Original Name',
      });

      const updated = await processor.updateCustomer(customer.customerId, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.email).toBe('update@example.com');
    });

    test('should delete a customer', async () => {
      const customer = await processor.createCustomer({
        email: 'delete@example.com',
        name: 'Delete Me',
      });

      await processor.deleteCustomer(customer.customerId);

      const retrieved = await processor.getCustomer(customer.customerId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Payment Methods', () => {
    let customerId: string;

    beforeEach(async () => {
      const customer = await processor.createCustomer({
        email: 'payment@example.com',
        name: 'Payment Test',
      });
      customerId = customer.customerId;
    });

    test('should add a payment method', async () => {
      const paymentMethod = await processor.addPaymentMethod(customerId, {
        type: 'credit_card',
        isDefault: true,
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2025,
      });

      expect(paymentMethod.paymentMethodId).toBeDefined();
      expect(paymentMethod.type).toBe('credit_card');
      expect(paymentMethod.last4).toBe('4242');
    });

    test('should set default payment method', async () => {
      const pm1 = await processor.addPaymentMethod(customerId, {
        type: 'credit_card',
        isDefault: true,
        last4: '1111',
      });

      const pm2 = await processor.addPaymentMethod(customerId, {
        type: 'credit_card',
        isDefault: false,
        last4: '2222',
      });

      await processor.setDefaultPaymentMethod(customerId, pm2.paymentMethodId);

      const customer = await processor.getCustomer(customerId);
      expect(customer?.defaultPaymentMethodId).toBe(pm2.paymentMethodId);
    });

    test('should remove payment method', async () => {
      const paymentMethod = await processor.addPaymentMethod(customerId, {
        type: 'credit_card',
        isDefault: true,
        last4: '3333',
      });

      await processor.removePaymentMethod(customerId, paymentMethod.paymentMethodId);

      const customer = await processor.getCustomer(customerId);
      expect(customer?.paymentMethods).toEqual([]);
    });
  });

  describe('Products and Pricing', () => {
    test('should create a product', async () => {
      const product = await processor.createProduct({
        name: 'Professional Plan',
        description: 'Full access plan',
        prices: [],
        active: true,
      });

      expect(product.productId).toBeDefined();
      expect(product.name).toBe('Professional Plan');
    });

    test('should create a price', async () => {
      const product = await processor.createProduct({
        name: 'Test Product',
        prices: [],
        active: true,
      });

      const price = await processor.createPrice({
        productId: product.productId,
        amount: 9900,
        currency: 'usd',
        billingCycle: 'monthly',
        pricingModel: 'fixed',
        isRecurring: true,
      });

      expect(price.priceId).toBeDefined();
      expect(price.amount).toBe(9900);
      expect(price.billingCycle).toBe('monthly');
    });

    test('should retrieve a product', async () => {
      const created = await processor.createProduct({
        name: 'Retrieve Test',
        prices: [],
        active: true,
      });

      const retrieved = await processor.getProduct(created.productId);
      expect(retrieved?.name).toBe('Retrieve Test');
    });
  });

  describe('Charges and Payments', () => {
    let customerId: string;

    beforeEach(async () => {
      const customer = await processor.createCustomer({
        email: 'charge@example.com',
        name: 'Charge Test',
      });
      customerId = customer.customerId;
    });

    test('should create a charge', async () => {
      const charge = await processor.createCharge({
        customerId,
        amount: 5000,
        currency: 'usd',
        description: 'Test charge',
      } as any);

      expect(charge.chargeId).toBeDefined();
      expect(charge.amount).toBe(5000);
      expect(['succeeded', 'failed']).toContain(charge.status);
    });

    test('should retrieve a charge', async () => {
      const created = await processor.createCharge({
        customerId,
        amount: 1000,
        currency: 'usd',
      } as any);

      const retrieved = await processor.getCharge(created.chargeId);
      expect(retrieved?.chargeId).toBe(created.chargeId);
    });
  });

  describe('Subscriptions', () => {
    let customerId: string;
    let priceId: string;

    beforeEach(async () => {
      const customer = await processor.createCustomer({
        email: 'subscription@example.com',
        name: 'Subscription Test',
      });
      customerId = customer.customerId;

      const product = await processor.createProduct({
        name: 'Subscription Product',
        prices: [],
        active: true,
      });

      const price = await processor.createPrice({
        productId: product.productId,
        amount: 9900,
        currency: 'usd',
        billingCycle: 'monthly',
        pricingModel: 'fixed',
        isRecurring: true,
      });

      priceId = price.priceId;
    });

    test('should create a subscription', async () => {
      const subscription = await processor.createSubscription({
        customerId,
        priceId,
        status: 'active',
      } as any);

      expect(subscription.subscriptionId).toBeDefined();
      expect(subscription.customerId).toBe(customerId);
      expect(subscription.status).toBe('active');
    });

    test('should retrieve a subscription', async () => {
      const created = await processor.createSubscription({
        customerId,
        priceId,
        status: 'active',
      } as any);

      const retrieved = await processor.getSubscription(created.subscriptionId);
      expect(retrieved?.subscriptionId).toBe(created.subscriptionId);
    });

    test('should update a subscription', async () => {
      const subscription = await processor.createSubscription({
        customerId,
        priceId,
        status: 'active',
      } as any);

      const updated = await processor.updateSubscription(subscription.subscriptionId, {
        status: 'paused',
      });

      expect(updated.status).toBe('paused');
    });

    test('should cancel a subscription', async () => {
      const subscription = await processor.createSubscription({
        customerId,
        priceId,
        status: 'active',
      } as any);

      const canceled = await processor.cancelSubscription(subscription.subscriptionId, false);

      expect(canceled.status).toBe('canceled');
      expect(canceled.canceledAt).toBeDefined();
    });

    test('should pause and resume subscription', async () => {
      const subscription = await processor.createSubscription({
        customerId,
        priceId,
        status: 'active',
      } as any);

      const paused = await processor.pauseSubscription(subscription.subscriptionId);
      expect(paused.status).toBe('paused');

      const resumed = await processor.resumeSubscription(subscription.subscriptionId);
      expect(resumed.status).toBe('active');
    });
  });

  describe('Refunds and Disputes', () => {
    let chargeId: string;

    beforeEach(async () => {
      const customer = await processor.createCustomer({
        email: 'refund@example.com',
        name: 'Refund Test',
      });

      const charge = await processor.createCharge({
        customerId: customer.customerId,
        amount: 5000,
        currency: 'usd',
      } as any);

      chargeId = charge.chargeId;
    });

    test('should create a refund', async () => {
      const refund = await processor.createRefund(chargeId, 2500, 'customer_request');

      expect(refund.refundId).toBeDefined();
      expect(refund.chargeId).toBe(chargeId);
      expect(refund.amount).toBe(2500);
      expect(refund.reason).toBe('customer_request');
    });

    test('should retrieve a refund', async () => {
      const created = await processor.createRefund(chargeId, 1000, 'test');

      const retrieved = await processor.getRefund(created.refundId);
      expect(retrieved?.refundId).toBe(created.refundId);
    });

    test('should create a dispute', async () => {
      const dispute = await processor.createDispute(chargeId, 'fraudulent');

      expect(dispute.disputeId).toBeDefined();
      expect(dispute.chargeId).toBe(chargeId);
      expect(dispute.reason).toBe('fraudulent');
      expect(dispute.evidenceDeadline).toBeDefined();
    });
  });

  describe('Checkout Sessions', () => {
    test('should create a checkout session', async () => {
      const session = await processor.createCheckoutSession({
        lineItems: [{ priceId: 'price_123', quantity: 1 }],
        mode: 'payment',
        paymentMethodTypes: ['credit_card' as any],
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        status: 'open',
        expiresAt: new Date(),
      } as any);

      expect(session.sessionId).toBeDefined();
      expect(session.url).toContain('checkout.stripe.com');
    });
  });

  describe('Billing Portal', () => {
    test('should create billing portal session', async () => {
      const customer = await processor.createCustomer({
        email: 'portal@example.com',
        name: 'Portal Test',
      });

      const session = await processor.createBillingPortalSession(customer.customerId);

      expect(session.sessionId).toBeDefined();
      expect(session.url).toContain('billing.stripe.com');
      expect(session.expiresAt.getTime()).toBeGreaterThan(new Date().getTime());
    });
  });

  describe('Usage-based Billing', () => {
    test('should record usage', async () => {
      const record = await processor.recordUsage('si_123', 100, 'increment');

      expect(record.recordId).toBeDefined();
      expect(record.subscriptionItemId).toBe('si_123');
      expect(record.quantity).toBe(100);
      expect(record.action).toBe('increment');
    });

    test('should retrieve usage records', async () => {
      await processor.recordUsage('si_456', 50, 'set');
      await processor.recordUsage('si_456', 25, 'increment');

      const records = await processor.getUsageRecords('si_456', new Date(), new Date());

      expect(records.length).toBe(2);
    });
  });

  describe('Webhooks', () => {
    test('should register and process webhook handlers', async () => {
      const mockHandler = jest.fn();

      processor.registerWebhookHandler('charge.succeeded', mockHandler);

      const event = {
        eventId: 'evt_123',
        type: 'charge.succeeded',
        data: { chargeId: 'ch_123' },
        createdAt: new Date(),
      };

      await processor.processWebhook(event);

      expect(mockHandler).toHaveBeenCalledWith(event);
    });
  });

  describe('Reporting', () => {
    test('should generate billing report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await processor.generateBillingReport(startDate, endDate);

      expect(report.reportId).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(report.periodStart).toEqual(startDate);
      expect(report.periodEnd).toEqual(endDate);
      expect(report.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(report.totalCharges).toBeGreaterThanOrEqual(0);
    });

    test('should get metrics', async () => {
      const metrics = await processor.getMetrics();

      expect(metrics).toHaveProperty('mrr');
      expect(metrics).toHaveProperty('arr');
      expect(metrics).toHaveProperty('churnRate');
      expect(metrics).toHaveProperty('ltv');
    });
  });
});

describe('StripeManus', () => {
  let stripeManus: StripeManus;

  beforeEach(() => {
    stripeManus = new StripeManus();
  });

  test('should setup SaaS subscription', async () => {
    const result = await stripeManus.setupSaaSSubscription('customer@example.com', 'John Doe');

    expect(result.customer).toBeDefined();
    expect(result.product).toBeDefined();
    expect(result.monthlyPrice).toBeDefined();
    expect(result.paymentMethod).toBeDefined();
    expect(result.subscription).toBeDefined();
  });

  test('should create ecommerce checkout', async () => {
    const checkout = await stripeManus.createEcommerceCheckout([{ priceId: 'price_123', quantity: 2 }]);

    expect(checkout.sessionId).toBeDefined();
    expect(checkout.url).toBeDefined();
  });

  test('should setup usage-based billing', async () => {
    const customer = await stripeManus.createCustomer('usage@example.com', 'Usage Test');

    const result = await stripeManus.setupUsageBasedBilling(customer.customerId, 'API Usage');

    expect(result.product).toBeDefined();
    expect(result.price).toBeDefined();
    expect(result.subscription).toBeDefined();
  });

  test('should manage full subscription lifecycle', async () => {
    // Create customer
    const customer = await stripeManus.createCustomer('lifecycle@example.com', 'Lifecycle Test');

    // Add payment method
    const paymentMethod = await stripeManus.addPaymentMethod(customer.customerId, 'credit_card', '4242');
    expect(paymentMethod).toBeDefined();

    // Create product and price
    const product = await stripeManus.createProduct('Test Plan');
    const price = await stripeManus.createPrice(product.productId, 2999, 'monthly');

    // Create subscription
    const subscription = await stripeManus.createSubscription(customer.customerId, price.priceId);
    expect(subscription.status).toBe('active');

    // Cancel subscription
    const canceled = await stripeManus.cancelSubscription(subscription.subscriptionId, false);
    expect(canceled.status).toBe('canceled');
  });

  test('should generate reports', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    const report = await stripeManus.generateReport(startDate, endDate);

    expect(report).toBeDefined();
    expect(report.totalRevenue).toBeGreaterThanOrEqual(0);
  });

  test('should get metrics', async () => {
    const metrics = await stripeManus.getMetrics();

    expect(metrics.mrr).toBeGreaterThanOrEqual(0);
    expect(metrics.arr).toBeGreaterThanOrEqual(0);
    expect(metrics.ltv).toBeGreaterThanOrEqual(0);
  });
});
