import {
  createPaymentGateway,
  createPaymentProvider,
  generatePaymentId,
  generateRefundId,
  generateDisputeId,
  generateSubscriptionId,
  generatePlanId,
  generateCustomerId,
  generatePaymentMethodId,
  generateIntentId,
  generateWebhookEventId,
  formatCurrency,
  calculateRefundAmount,
  isValidPaymentState,
  isValidBillingCycle,
  isValidPaymentProvider,
  isValidDisputeReason,
  isValidDisputeStatus,
  isPayment,
  isPaymentMethod,
  isRefund,
  isDispute,
  isSubscription,
  isPlan,
  isCustomer,
  isWebhookEvent,
  isPaymentIntent,
  calculateSubscriptionEndDate,
  calculateTrialEndDate,
} from '../src/core/paymentGateway';
import type {
  PaymentProviderType,
  PaymentState,
  BillingCycle,
  PaymentMethod,
  Payment,
  Refund,
  Dispute,
  Subscription,
  Plan,
  Customer,
  PaymentIntent,
  WebhookEvent,
  RefundOptions,
  DisputeReason,
} from '../src/core/paymentGateway';

describe('PaymentGateway - Type Guards', () => {
  describe('isValidPaymentState', () => {
    it('should return true for valid payment states', () => {
      expect(isValidPaymentState('pending')).toBe(true);
      expect(isValidPaymentState('authorized')).toBe(true);
      expect(isValidPaymentState('captured')).toBe(true);
      expect(isValidPaymentState('refunded')).toBe(true);
      expect(isValidPaymentState('failed')).toBe(true);
    });

    it('should return false for invalid payment states', () => {
      expect(isValidPaymentState('invalid')).toBe(false);
      expect(isValidPaymentState('')).toBe(false);
      expect(isValidPaymentState('PENDING')).toBe(false);
    });
  });

  describe('isValidBillingCycle', () => {
    it('should return true for valid billing cycles', () => {
      expect(isValidBillingCycle('monthly')).toBe(true);
      expect(isValidBillingCycle('yearly')).toBe(true);
      expect(isValidBillingCycle('weekly')).toBe(true);
    });

    it('should return false for invalid billing cycles', () => {
      expect(isValidBillingCycle('daily')).toBe(false);
      expect(isValidBillingCycle('quarterly')).toBe(false);
      expect(isValidBillingCycle('')).toBe(false);
    });
  });

  describe('isValidPaymentProvider', () => {
    it('should return true for valid providers', () => {
      expect(isValidPaymentProvider('stripe')).toBe(true);
      expect(isValidPaymentProvider('paypal')).toBe(true);
      expect(isValidPaymentProvider('square')).toBe(true);
      expect(isValidPaymentProvider('adyen')).toBe(true);
    });

    it('should return false for invalid providers', () => {
      expect(isValidPaymentProvider('invalid')).toBe(false);
      expect(isValidPaymentProvider('Stripe')).toBe(false);
      expect(isValidPaymentProvider('')).toBe(false);
    });
  });

  describe('isValidDisputeReason', () => {
    it('should return true for valid dispute reasons', () => {
      expect(isValidDisputeReason('fraudulent')).toBe(true);
      expect(isValidDisputeReason('duplicate')).toBe(true);
      expect(isValidDisputeReason('product_not_received')).toBe(true);
    });

    it('should return false for invalid dispute reasons', () => {
      expect(isValidDisputeReason('invalid')).toBe(false);
      expect(isValidDisputeReason('')).toBe(false);
    });
  });

  describe('isValidDisputeStatus', () => {
    it('should return true for valid dispute statuses', () => {
      expect(isValidDisputeStatus('open')).toBe(true);
      expect(isValidDisputeStatus('won')).toBe(true);
      expect(isValidDisputeStatus('lost')).toBe(true);
      expect(isValidDisputeStatus('closed')).toBe(true);
    });

    it('should return false for invalid dispute statuses', () => {
      expect(isValidDisputeStatus('pending')).toBe(false);
      expect(isValidDisputeStatus('')).toBe(false);
    });
  });

  describe('isPayment', () => {
    it('should return true for valid payment', () => {
      const validPayment: Payment = {
        id: 'pay_abc123',
        provider: 'stripe',
        amount: 1000,
        currency: 'usd',
        state: 'captured',
        paymentMethod: { id: 'pm_123', type: 'card', isDefault: true },
        metadata: {},
        refundIds: [],
        disputeIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(isPayment(validPayment)).toBe(true);
    });

    it('should return false for invalid payment', () => {
      expect(isPayment(null)).toBe(false);
      expect(isPayment({ id: 'test' })).toBe(false);
      expect(isPayment({})).toBe(false);
    });
  });

  describe('isPaymentMethod', () => {
    it('should return true for valid payment method', () => {
      const validMethod: PaymentMethod = { id: 'pm_123', type: 'card', isDefault: true };
      expect(isPaymentMethod(validMethod)).toBe(true);
    });

    it('should return false for invalid payment method', () => {
      expect(isPaymentMethod(null)).toBe(false);
      expect(isPaymentMethod({ id: 'test' })).toBe(false);
    });
  });

  describe('isRefund', () => {
    it('should return true for valid refund', () => {
      const validRefund: Refund = {
        id: 'ref_abc123',
        paymentId: 'pay_123',
        provider: 'stripe',
        amount: 500,
        currency: 'usd',
        status: 'completed',
        createdAt: new Date(),
      };
      expect(isRefund(validRefund)).toBe(true);
    });

    it('should return false for invalid refund', () => {
      expect(isRefund(null)).toBe(false);
      expect(isRefund({ id: 'test' })).toBe(false);
    });
  });

  describe('isDispute', () => {
    it('should return true for valid dispute', () => {
      const validDispute: Dispute = {
        id: 'disp_abc123',
        paymentId: 'pay_123',
        provider: 'stripe',
        amount: 1000,
        currency: 'usd',
        reason: 'fraudulent',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(isDispute(validDispute)).toBe(true);
    });

    it('should return false for invalid dispute', () => {
      expect(isDispute(null)).toBe(false);
      expect(isDispute({ id: 'test' })).toBe(false);
    });
  });

  describe('isSubscription', () => {
    it('should return true for valid subscription', () => {
      const validSub: Subscription = {
        id: 'sub_abc123',
        customerId: 'cust_123',
        provider: 'stripe',
        planId: 'plan_123',
        planName: 'Basic Plan',
        billingCycle: 'monthly',
        amount: 999,
        currency: 'usd',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(isSubscription(validSub)).toBe(true);
    });

    it('should return false for invalid subscription', () => {
      expect(isSubscription(null)).toBe(false);
      expect(isSubscription({ id: 'test' })).toBe(false);
    });
  });

  describe('isPlan', () => {
    it('should return true for valid plan', () => {
      const validPlan: Plan = {
        id: 'plan_abc123',
        name: 'Premium Plan',
        amount: 1999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 14,
        metadata: {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(isPlan(validPlan)).toBe(true);
    });

    it('should return false for invalid plan', () => {
      expect(isPlan(null)).toBe(false);
      expect(isPlan({ id: 'test' })).toBe(false);
    });
  });

  describe('isCustomer', () => {
    it('should return true for valid customer', () => {
      const validCustomer: Customer = {
        id: 'cust_abc123',
        email: 'test@example.com',
        name: 'Test User',
        paymentMethods: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(isCustomer(validCustomer)).toBe(true);
    });

    it('should return false for invalid customer', () => {
      expect(isCustomer(null)).toBe(false);
      expect(isCustomer({ id: 'test' })).toBe(false);
    });
  });

  describe('isWebhookEvent', () => {
    it('should return true for valid webhook event', () => {
      const validEvent: WebhookEvent = {
        id: 'wh_abc123',
        provider: 'stripe',
        type: 'payment.completed',
        data: {},
        createdAt: new Date(),
        processed: false,
      };
      expect(isWebhookEvent(validEvent)).toBe(true);
    });

    it('should return false for invalid webhook event', () => {
      expect(isWebhookEvent(null)).toBe(false);
      expect(isWebhookEvent({ id: 'test' })).toBe(false);
    });
  });

  describe('isPaymentIntent', () => {
    it('should return true for valid payment intent', () => {
      const validIntent: PaymentIntent = {
        id: 'int_abc123',
        provider: 'stripe',
        amount: 1000,
        currency: 'usd',
        state: 'pending',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(isPaymentIntent(validIntent)).toBe(true);
    });

    it('should return false for invalid payment intent', () => {
      expect(isPaymentIntent(null)).toBe(false);
      expect(isPaymentIntent({ id: 'test' })).toBe(false);
    });
  });
});

describe('PaymentGateway - ID Generators', () => {
  describe('generatePaymentId', () => {
    it('should generate payment ID with correct prefix', () => {
      const id = generatePaymentId();
      expect(id.startsWith('pay_')).toBe(true);
    });

    it('should generate unique IDs', () => {
      const id1 = generatePaymentId();
      const id2 = generatePaymentId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateRefundId', () => {
    it('should generate refund ID with correct prefix', () => {
      const id = generateRefundId();
      expect(id.startsWith('ref_')).toBe(true);
    });
  });

  describe('generateDisputeId', () => {
    it('should generate dispute ID with correct prefix', () => {
      const id = generateDisputeId();
      expect(id.startsWith('disp_')).toBe(true);
    });
  });

  describe('generateSubscriptionId', () => {
    it('should generate subscription ID with correct prefix', () => {
      const id = generateSubscriptionId();
      expect(id.startsWith('sub_')).toBe(true);
    });
  });

  describe('generatePlanId', () => {
    it('should generate plan ID with correct prefix', () => {
      const id = generatePlanId();
      expect(id.startsWith('plan_')).toBe(true);
    });
  });

  describe('generateCustomerId', () => {
    it('should generate customer ID with correct prefix', () => {
      const id = generateCustomerId();
      expect(id.startsWith('cust_')).toBe(true);
    });
  });

  describe('generatePaymentMethodId', () => {
    it('should generate payment method ID with correct prefix', () => {
      const id = generatePaymentMethodId();
      expect(id.startsWith('pm_')).toBe(true);
    });
  });

  describe('generateIntentId', () => {
    it('should generate intent ID with correct prefix', () => {
      const id = generateIntentId();
      expect(id.startsWith('int_')).toBe(true);
    });
  });

  describe('generateWebhookEventId', () => {
    it('should generate webhook event ID with correct prefix', () => {
      const id = generateWebhookEventId();
      expect(id.startsWith('wh_')).toBe(true);
    });
  });
});

describe('PaymentGateway - Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format USD correctly', () => {
      expect(formatCurrency(1000, 'usd')).toBe('$10.00');
      expect(formatCurrency(1999, 'usd')).toBe('$19.99');
      expect(formatCurrency(0, 'usd')).toBe('$0.00');
    });

    it('should format EUR correctly', () => {
      expect(formatCurrency(1000, 'eur')).toBe('€10.00');
    });

    it('should format GBP correctly', () => {
      expect(formatCurrency(1000, 'gbp')).toBe('£10.00');
    });

    it('should handle unknown currencies', () => {
      expect(formatCurrency(1000, 'xyz')).toBe('XYZ 10.00');
    });
  });

  describe('calculateRefundAmount', () => {
    it('should return full amount when no partial refund specified', () => {
      const payment: Payment = {
        id: 'pay_123',
        provider: 'stripe',
        amount: 1000,
        currency: 'usd',
        state: 'captured',
        paymentMethod: { id: 'pm_123', type: 'card', isDefault: true },
        metadata: {},
        refundIds: [],
        disputeIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(calculateRefundAmount(payment)).toBe(1000);
    });

    it('should return partial amount when partial refund specified', () => {
      const payment: Payment = {
        id: 'pay_123',
        provider: 'stripe',
        amount: 1000,
        currency: 'usd',
        state: 'captured',
        paymentMethod: { id: 'pm_123', type: 'card', isDefault: true },
        metadata: {},
        refundIds: [],
        disputeIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const options: RefundOptions = { paymentId: 'pay_123', amount: 500, isPartial: true };
      expect(calculateRefundAmount(payment, options)).toBe(500);
    });

    it('should cap partial refund at payment amount', () => {
      const payment: Payment = {
        id: 'pay_123',
        provider: 'stripe',
        amount: 1000,
        currency: 'usd',
        state: 'captured',
        paymentMethod: { id: 'pm_123', type: 'card', isDefault: true },
        metadata: {},
        refundIds: [],
        disputeIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const options: RefundOptions = { paymentId: 'pay_123', amount: 2000, isPartial: true };
      expect(calculateRefundAmount(payment, options)).toBe(1000);
    });
  });

  describe('calculateSubscriptionEndDate', () => {
    it('should calculate weekly subscription end date', () => {
      const start = new Date('2024-01-01');
      const end = calculateSubscriptionEndDate(start, 'weekly');
      expect(end.getDate()).toBe(8);
    });

    it('should calculate monthly subscription end date', () => {
      const start = new Date('2024-01-01');
      const end = calculateSubscriptionEndDate(start, 'monthly');
      expect(end.getMonth()).toBe(1);
    });

    it('should calculate yearly subscription end date', () => {
      const start = new Date('2024-01-01');
      const end = calculateSubscriptionEndDate(start, 'yearly');
      expect(end.getFullYear()).toBe(2025);
    });
  });

  describe('calculateTrialEndDate', () => {
    it('should calculate trial end date correctly', () => {
      const start = new Date('2024-01-01');
      const end = calculateTrialEndDate(start, 14);
      expect(end.getDate()).toBe(15);
    });
  });
});

describe('PaymentGateway - Payment Providers', () => {
  describe('createPaymentProvider', () => {
    it('should create stripe provider', () => {
      const provider = createPaymentProvider('stripe');
      expect(provider.type).toBe('stripe');
    });

    it('should create paypal provider', () => {
      const provider = createPaymentProvider('paypal');
      expect(provider.type).toBe('paypal');
    });

    it('should create square provider', () => {
      const provider = createPaymentProvider('square');
      expect(provider.type).toBe('square');
    });

    it('should create adyen provider', () => {
      const provider = createPaymentProvider('adyen');
      expect(provider.type).toBe('adyen');
    });

    it('should throw for invalid provider type', () => {
      expect(() => createPaymentProvider('invalid' as PaymentProviderType)).toThrow();
    });
  });
});

describe('PaymentGateway - Gateway Instance', () => {
  let gateway: ReturnType<typeof createPaymentGateway>;

  beforeEach(() => {
    gateway = createPaymentGateway();
  });

  describe('Customer Operations', () => {
    it('should create a customer', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      expect(customer.email).toBe('test@example.com');
      expect(customer.name).toBe('Test User');
      expect(customer.id).toBeTruthy();
    });

    it('should get a customer', async () => {
      const created = await gateway.createCustomer('test@example.com', 'Test User');
      const retrieved = await gateway.getCustomer(created.id);
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.email).toBe('test@example.com');
    });

    it('should return null for non-existent customer', async () => {
      const customer = await gateway.getCustomer('non_existent_id');
      expect(customer).toBeNull();
    });

    it('should update a customer', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const updated = await gateway.updateCustomer(customer.id, { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');
    });

    it('should delete a customer', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const deleted = await gateway.deleteCustomer(customer.id);
      expect(deleted).toBe(true);
      const retrieved = await gateway.getCustomer(customer.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Payment Method Operations', () => {
    it('should add a payment method to customer', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const paymentMethod = await gateway.addPaymentMethod(customer.id, {
        type: 'card',
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2025,
        isDefault: true,
      });
      expect(paymentMethod.type).toBe('card');
      expect(paymentMethod.last4).toBe('4242');
      expect(paymentMethod.id).toBeTruthy();
    });

    it('should get payment methods for customer', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const methods = await gateway.getPaymentMethods(customer.id);
      expect(methods.length).toBe(1);
    });

    it('should remove a payment method', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const removed = await gateway.removePaymentMethod(customer.id, method.id);
      expect(removed).toBe(true);
      const methods = await gateway.getPaymentMethods(customer.id);
      expect(methods.length).toBe(0);
    });

    it('should set default payment method', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method1 = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const method2 = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: false });
      await gateway.setDefaultPaymentMethod(customer.id, method2.id);
      const methods = await gateway.getPaymentMethods(customer.id);
      const defaultMethod = methods.find((m) => m.id === method2.id);
      expect(defaultMethod?.isDefault).toBe(true);
    });
  });

  describe('Payment Operations', () => {
    it('should authorize a payment', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const payment = await gateway.authorizePayment(method.id, 1000, 'usd', {
        customerId: customer.id,
        description: 'Test authorization',
      });
      expect(payment.state).toBe('authorized');
      expect(payment.amount).toBe(1000);
      expect(payment.authorizationCode).toBeTruthy();
    });

    it('should capture an authorized payment', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const authorized = await gateway.authorizePayment(method.id, 1000, 'usd');
      const captured = await gateway.capturePayment(authorized.id);
      expect(captured.state).toBe('captured');
      expect(captured.captureId).toBeTruthy();
      expect(captured.capturedAt).toBeTruthy();
    });

    it('should charge a payment directly', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const payment = await gateway.chargePayment(method.id, 1000, 'usd', {
        customerId: customer.id,
      });
      expect(payment.state).toBe('captured');
      expect(payment.captureId).toBeTruthy();
    });

    it('should get a payment', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const created = await gateway.chargePayment(method.id, 1000, 'usd');
      const retrieved = await gateway.getPayment(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    it('should list payments for customer', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      await gateway.chargePayment(method.id, 1000, 'usd', { customerId: customer.id });
      await gateway.chargePayment(method.id, 2000, 'usd', { customerId: customer.id });
      const payments = await gateway.listPayments(customer.id);
      expect(payments.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Refund Operations', () => {
    it('should refund a payment', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const payment = await gateway.chargePayment(method.id, 1000, 'usd');
      const refund = await gateway.refundPayment({ paymentId: payment.id });
      expect(refund.status).toBe('completed');
      expect(refund.paymentId).toBe(payment.id);
    });

    it('should partially refund a payment', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const payment = await gateway.chargePayment(method.id, 1000, 'usd');
      const refund = await gateway.refundPayment({
        paymentId: payment.id,
        amount: 500,
        isPartial: true,
        reason: 'Product not as expected',
      });
      expect(refund.amount).toBe(500);
    });
  });

  describe('Dispute Operations', () => {
    it('should create a dispute', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const payment = await gateway.chargePayment(method.id, 1000, 'usd');
      const dispute = await gateway.createDispute(payment.id, 'fraudulent');
      expect(dispute.status).toBe('open');
      expect(dispute.reason).toBe('fraudulent');
    });

    it('should get a dispute', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const payment = await gateway.chargePayment(method.id, 1000, 'usd');
      const created = await gateway.createDispute(payment.id, 'fraudulent');
      const retrieved = await gateway.getDispute(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    it('should accept a dispute', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const payment = await gateway.chargePayment(method.id, 1000, 'usd');
      const dispute = await gateway.createDispute(payment.id, 'fraudulent');
      const accepted = await gateway.acceptDispute(dispute.id);
      expect(accepted.status).toBe('lost');
    });
  });

  describe('Plan Operations', () => {
    it('should create a plan', async () => {
      const plan = await gateway.createPlan({
        name: 'Premium Plan',
        description: 'Premium features',
        amount: 1999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 14,
        metadata: {},
        isActive: true,
      });
      expect(plan.name).toBe('Premium Plan');
      expect(plan.amount).toBe(1999);
      expect(plan.id).toBeTruthy();
    });

    it('should get a plan', async () => {
      const created = await gateway.createPlan({
        name: 'Basic Plan',
        amount: 999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 7,
        metadata: {},
        isActive: true,
      });
      const retrieved = await gateway.getPlan(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    it('should update a plan', async () => {
      const plan = await gateway.createPlan({
        name: 'Basic Plan',
        amount: 999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 7,
        metadata: {},
        isActive: true,
      });
      const updated = await gateway.updatePlan(plan.id, { amount: 1299 });
      expect(updated.amount).toBe(1299);
    });

    it('should delete a plan', async () => {
      const plan = await gateway.createPlan({
        name: 'Temp Plan',
        amount: 999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 0,
        metadata: {},
        isActive: true,
      });
      const deleted = await gateway.deletePlan(plan.id);
      expect(deleted).toBe(true);
      const retrieved = await gateway.getPlan(plan.id);
      expect(retrieved).toBeNull();
    });

    it('should list plans', async () => {
      await gateway.createPlan({
        name: 'Plan A',
        amount: 999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 0,
        metadata: {},
        isActive: true,
      });
      await gateway.createPlan({
        name: 'Plan B',
        amount: 1999,
        currency: 'usd',
        billingCycle: 'yearly',
        trialDays: 0,
        metadata: {},
        isActive: true,
      });
      const plans = await gateway.listPlans();
      expect(plans.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Subscription Operations', () => {
    it('should create a subscription', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const plan = await gateway.createPlan({
        name: 'Pro Plan',
        amount: 2999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 0,
        metadata: {},
        isActive: true,
      });
      const subscription = await gateway.createSubscription(customer.id, plan.id, method.id);
      expect(subscription.status).toBe('active');
      expect(subscription.amount).toBe(2999);
    });

    it('should get a subscription', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const plan = await gateway.createPlan({
        name: 'Pro Plan',
        amount: 2999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 0,
        metadata: {},
        isActive: true,
      });
      const created = await gateway.createSubscription(customer.id, plan.id, method.id);
      const retrieved = await gateway.getSubscription(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    it('should cancel a subscription', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const plan = await gateway.createPlan({
        name: 'Pro Plan',
        amount: 2999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 0,
        metadata: {},
        isActive: true,
      });
      const subscription = await gateway.createSubscription(customer.id, plan.id, method.id);
      const canceled = await gateway.cancelSubscription(subscription.id, true);
      expect(canceled.cancelAtPeriodEnd).toBe(true);
    });

    it('should pause a subscription', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const plan = await gateway.createPlan({
        name: 'Pro Plan',
        amount: 2999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 0,
        metadata: {},
        isActive: true,
      });
      const subscription = await gateway.createSubscription(customer.id, plan.id, method.id);
      const paused = await gateway.pauseSubscription(subscription.id);
      expect(paused.status).toBe('paused');
    });

    it('should resume a paused subscription', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const plan = await gateway.createPlan({
        name: 'Pro Plan',
        amount: 2999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 0,
        metadata: {},
        isActive: true,
      });
      const subscription = await gateway.createSubscription(customer.id, plan.id, method.id);
      await gateway.pauseSubscription(subscription.id);
      const resumed = await gateway.resumeSubscription(subscription.id);
      expect(resumed.status).toBe('active');
    });

    it('should update a subscription', async () => {
      const customer = await gateway.createCustomer('test@example.com', 'Test User');
      const method = await gateway.addPaymentMethod(customer.id, { type: 'card', isDefault: true });
      const plan = await gateway.createPlan({
        name: 'Pro Plan',
        amount: 2999,
        currency: 'usd',
        billingCycle: 'monthly',
        trialDays: 0,
        metadata: {},
        isActive: true,
      });
      const subscription = await gateway.createSubscription(customer.id, plan.id, method.id);
      const updated = await gateway.updateSubscription(subscription.id, { couponCode: 'SAVE10' });
      expect(updated.couponCode).toBe('SAVE10');
    });
  });

  describe('Payment Intent Operations', () => {
    it('should create a payment intent', async () => {
      const intent = await gateway.createPaymentIntent(1000, 'usd', 'cust_123');
      expect(intent.state).toBe('pending');
      expect(intent.amount).toBe(1000);
    });

    it('should get a payment intent', async () => {
      const created = await gateway.createPaymentIntent(1000, 'usd');
      const retrieved = await gateway.getPaymentIntent(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    it('should confirm a payment intent', async () => {
      const intent = await gateway.createPaymentIntent(1000, 'usd');
      const confirmed = await gateway.confirmPaymentIntent(intent.id, 'pm_123');
      expect(confirmed.state).toBe('captured');
    });

    it('should cancel a payment intent', async () => {
      const intent = await gateway.createPaymentIntent(1000, 'usd');
      const canceled = await gateway.cancelPaymentIntent(intent.id);
      expect(canceled.state).toBe('failed');
    });
  });

  describe('Webhook Processing', () => {
    it('should process a webhook event', async () => {
      const payload = {
        type: 'payment.completed',
        id: 'evt_123',
        payment_id: 'pay_123',
      };
      const event = await gateway.processWebhook('stripe', payload, {});
      expect(event.type).toBe('payment.completed');
      expect(event.provider).toBe('stripe');
    });

    it('should validate webhook signature', async () => {
      const payload = JSON.stringify({ type: 'test' });
      const hash = require('crypto').createHash('sha256').update(payload).digest('hex');
      const isValid = await gateway.validateWebhookSignature('stripe', payload, hash);
      expect(isValid).toBe(true);
    });
  });
});

describe('PaymentGateway - Multiple Providers', () => {
  it('should support multiple providers', async () => {
    const gateway = createPaymentGateway({ defaultProvider: 'stripe' });
    const stripeProvider = gateway.getProvider('stripe');
    const paypalProvider = gateway.getProvider('paypal');
    const squareProvider = gateway.getProvider('square');
    const adyenProvider = gateway.getProvider('adyen');
    expect(stripeProvider.type).toBe('stripe');
    expect(paypalProvider.type).toBe('paypal');
    expect(squareProvider.type).toBe('square');
    expect(adyenProvider.type).toBe('adyen');
  });
});
