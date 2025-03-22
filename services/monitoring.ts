import { supabase } from './supabase';
import { sendEmail } from './email'; // You'll need to implement this
import { sendSlackAlert } from './slack'; // You'll need to implement this

interface AlertThresholds {
  failureRate: number;  // percentage
  consecutiveFailures: number;
  amountThreshold: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  failureRate: 10, // Alert if failure rate exceeds 10%
  consecutiveFailures: 3,
  amountThreshold: 100000, // ₦100,000
};

export const monitorTransactions = async (thresholds: AlertThresholds = DEFAULT_THRESHOLDS) => {
  try {
    // Get transactions from the last hour
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', hourAgo);

    if (error) throw error;

    // Calculate metrics
    const totalTransactions = transactions.length;
    const failedTransactions = transactions.filter(t => t.status === 'failed');
    const failureRate = (failedTransactions.length / totalTransactions) * 100;

    // Check for consecutive failures
    const lastTransactions = transactions
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, thresholds.consecutiveFailures);
    
    const hasConsecutiveFailures = lastTransactions.length >= thresholds.consecutiveFailures &&
      lastTransactions.every(t => t.status === 'failed');

    // Check for high-value failures
    const highValueFailures = failedTransactions.filter(t => t.amount >= thresholds.amountThreshold);

    // Generate alerts if needed
    if (failureRate > thresholds.failureRate ||
        hasConsecutiveFailures ||
        highValueFailures.length > 0) {
      
      const alertData = {
        timestamp: new Date().toISOString(),
        metrics: {
          totalTransactions,
          failedTransactions: failedTransactions.length,
          failureRate,
          consecutiveFailures: hasConsecutiveFailures,
          highValueFailures: highValueFailures.length,
        },
        details: {
          recentFailures: failedTransactions.slice(0, 5),
          highValueFailures,
        },
      };

      // Log alert
      await supabase
        .from('monitoring_alerts')
        .insert({
          type: 'transaction_failure',
          data: alertData,
          created_at: new Date().toISOString(),
        });

      // Send notifications
      await Promise.all([
        sendEmail({
          subject: 'Transaction Failure Alert',
          body: JSON.stringify(alertData, null, 2),
          to: process.env.ALERT_EMAIL,
        }),
        sendSlackAlert({
          channel: '#payment-alerts',
          text: `🚨 Transaction Failure Alert\n\`\`\`${JSON.stringify(alertData, null, 2)}\`\`\``,
        }),
      ]);
    }

    // Return monitoring report
    return {
      timestamp: new Date().toISOString(),
      metrics: {
        totalTransactions,
        failureRate,
        consecutiveFailures: hasConsecutiveFailures,
        highValueFailures: highValueFailures.length,
      },
    };
  } catch (error) {
    console.error('Monitoring error:', error);
    throw error;
  }
};

// Add real-time monitoring
export const setupRealtimeMonitoring = () => {
  const channel = supabase
    .channel('transaction_monitoring')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
        filter: "status=eq.'failed'",
      },
      async (payload) => {
        try {
          // Check if this failure requires immediate attention
          const transaction = payload.new;
          const requiresImmediate = transaction.amount >= DEFAULT_THRESHOLDS.amountThreshold;

          if (requiresImmediate) {
            const alertData = {
              timestamp: new Date().toISOString(),
              transaction,
              reason: 'High-value transaction failure',
            };

            await Promise.all([
              sendEmail({
                subject: '🚨 Immediate Action Required: High-value Transaction Failed',
                body: JSON.stringify(alertData, null, 2),
                to: process.env.URGENT_ALERT_EMAIL,
              }),
              sendSlackAlert({
                channel: '#urgent-payments',
                text: `⚠️ URGENT: High-value transaction failed\n\`\`\`${JSON.stringify(alertData, null, 2)}\`\`\``,
              }),
            ]);
          }
        } catch (error) {
          console.error('Real-time monitoring error:', error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}; 