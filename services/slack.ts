interface SlackMessage {
  channel: string;
  text: string;
}

export const sendSlackAlert = async ({ channel, text }: SlackMessage) => {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
        username: 'Payment Monitor',
        icon_emoji: ':warning:',
      }),
    });

    const data = await response.json();
    if (!data.ok) throw new Error(data.error);
  } catch (error) {
    console.error('Slack alert error:', error);
    throw error;
  }
}; 