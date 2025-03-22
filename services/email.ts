interface EmailParams {
  subject: string;
  body: string;
  to: string;
}

export const sendEmail = async ({ subject, body, to }: EmailParams) => {
  // Implement your email sending logic here
  // You could use services like SendGrid, AWS SES, etc.
  console.log('Sending email:', { subject, to, body });
}; 