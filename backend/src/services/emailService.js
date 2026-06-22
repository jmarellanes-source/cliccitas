// backend/src/services/emailService.js
const nodemailer = require('nodemailer');  // o usar Resend, SendGrid, etc.

// Configuración del transporter (ejemplo con nodemailer)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Función para enviar correo de confirmación
const sendAppointmentConfirmation = async (appointment, token, tokenExpiresAt, storeName, employeeName) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const link = `${baseUrl}/mis-citas?token=${token}`;
  
  const formattedDate = new Date(appointment.start_time).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const formattedTime = new Date(appointment.start_time).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .btn { display: inline-block; padding: 12px 24px; background: #3B82F6; color: white; text-decoration: none; border-radius: 6px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
        .highlight { font-weight: bold; color: #3B82F6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Confirmación de Cita</h1>
        </div>
        <div class="content">
          <h2>¡Hola ${appointment.customer_name}!</h2>
          <p>Tu cita ha sido agendada exitosamente con <strong>${employeeName || 'nosotros'}</strong>.</p>
          
          <div class="details">
            <p><strong>📍 Tienda:</strong> ${storeName}</p>
            <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
            <p><strong>🕐 Hora:</strong> ${formattedTime}</p>
            ${appointment.customer_phone ? `<p><strong>📞 Teléfono:</strong> ${appointment.customer_phone}</p>` : ''}
            ${appointment.notes ? `<p><strong>📝 Notas:</strong> ${appointment.notes}</p>` : ''}
          </div>
          
          <p>Para gestionar tu cita (confirmar, cancelar o agregar notas), haz clic en el siguiente enlace:</p>
          <p style="text-align: center; margin: 25px 0;">
            <a href="${link}" class="btn">📋 Gestionar mi cita</a>
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            ⚠️ Este enlace expirará el <strong>${new Date(tokenExpiresAt).toLocaleDateString('es-MX')}</strong>.
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            Si no agendaste esta cita, puedes ignorar este correo.
          </p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@tutienda.com',
      to: appointment.customer_email,
      subject: `✅ Confirmación de cita - ${storeName}`,
      html: emailHtml,
      text: `Hola ${appointment.customer_name},\n\nTu cita ha sido agendada.\n\nFecha: ${formattedDate}\nHora: ${formattedTime}\n\nPara gestionar tu cita, visita: ${link}\n\nEste enlace expirará el ${new Date(tokenExpiresAt).toLocaleDateString('es-MX')}.`
    });
    
    console.log('✅ Email enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendAppointmentConfirmation };