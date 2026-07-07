// backend/src/services/emailService.js
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const supabaseService = require('./supabase');

// Configuración del transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Función para generar token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Función para enviar correo de "Cita en revisión" (SIN enlace)
const sendAppointmentConfirmation = async (appointment, start_time_local, token, tokenExpiresAt, storeName, employeeName) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  // ✅ Ya no usamos el token en este email, solo en el segundo correo
  
  console.log("Hora local recibida (revisión):", start_time_local);

  let dateToUse = start_time_local;
  if (!(start_time_local instanceof Date) || isNaN(start_time_local.getTime())) {
    console.warn('start_time_local no es válido, usando fallback UTC');
    dateToUse = new Date(appointment.start_time);
  }

  const formattedDate = dateToUse.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const formattedTime = dateToUse.toLocaleTimeString('es-MX', {
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
        .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Cita recibida, en revisión</h1>
        </div>
        <div class="content">
          <h2>¡Hola ${appointment.customer_name}!</h2>
          <p>Tu cita ha sido enviada exitosamente a <strong>${employeeName || 'uno de nuestros profesionales'}</strong>.</p>
          
          <div class="details">
            <p><strong>📍 Tienda:</strong> ${storeName}</p>
            <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
            <p><strong>🕐 Hora:</strong> ${formattedTime}</p>
            ${appointment.customer_phone ? `<p><strong>📞 Teléfono:</strong> ${appointment.customer_phone}</p>` : ''}
            ${appointment.notes ? `<p><strong>📝 Notas:</strong> ${appointment.notes}</p>` : ''}
          </div>
          
          <p>Por favor espera un email de confirmación cuando <strong>${employeeName || 'uno de nuestros profesionales'}</strong> lo haya revisado.</p>
          
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
      subject: `Cita en revisión - ${storeName}`,
      html: emailHtml,
      text: `Hola ${appointment.customer_name},\n\nTu cita ha sido enviada para revisión.\n\nFecha: ${formattedDate}\nHora: ${formattedTime}\n\nRecibirás un correo de confirmación cuando sea aprobada.`
    });
    
    console.log('Email de "en revisión" enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error enviando email de revisión:', error);
    return { success: false, error: error.message };
  }
};

// Función para enviar correo de "Cita confirmada" (CON enlace para cancelar)
const sendAppointmentConfirmed = async (appointment, startDateTime, storeName, employeeName, storeSlug) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  console.log("📧 Enviando confirmación para:", appointment.customer_email);
  
  let dateToUse = startDateTime;
  if (!(startDateTime instanceof Date) || isNaN(startDateTime.getTime())) {
    console.warn('⚠️ startDateTime no es válido, usando fallback UTC');
    dateToUse = new Date(appointment.start_time);
  }
  
  const formattedDate = dateToUse.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const formattedTime = dateToUse.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // ✅ Generar token para que el cliente pueda cancelar
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  // ✅ Guardar token en la BD
  try {
    const { error: tokenError } = await supabaseService.admin
      .from('appointment_tokens')
      .insert({
        appointment_id: appointment.id,
        token: token,
        email: appointment.customer_email,
        expires_at: expiresAt.toISOString(),
        is_used: false
      });
    
    if (tokenError) {
      console.error('Error guardando token de cancelación:', tokenError);
    } else {
      console.log('Token de cancelación generado:', token);
    }
  } catch (error) {
    console.error('Error guardando token:', error);
  }
  
  // Incluir el slug en el enlace
  const link = storeSlug 
    ? `${baseUrl}/${storeSlug}/citas?token=${token}` 
    : `${baseUrl}/mis-citas?token=${token}`;
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .btn { display: inline-block; padding: 12px 24px; background: #3B82F6; color: white; text-decoration: none; border-radius: 6px; }
        .btn-cancel { display: inline-block; padding: 12px 24px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ ¡Cita Confirmada!</h1>
        </div>
        <div class="content">
          <h2>¡Hola ${appointment.customer_name}!</h2>
          <p>Tu cita ha sido <strong>confirmada</strong> por <strong>${employeeName || 'uno de nuestros profesionales'}</strong>.</p>
          
          <div class="details">
            <p><strong>📍 Tienda:</strong> ${storeName}</p>
            <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
            <p><strong>🕐 Hora:</strong> ${formattedTime}</p>
            ${appointment.customer_phone ? `<p><strong>📞 Teléfono:</strong> ${appointment.customer_phone}</p>` : ''}
            ${appointment.notes ? `<p><strong>📝 Notas:</strong> ${appointment.notes}</p>` : ''}
          </div>
          
          <p style="text-align: center; margin: 25px 0;">
            <a href="${link}" class="btn">📋 Ver mi cita</a>
          </p>
          
          <p style="text-align: center; margin: 15px 0;">
            <a href="${link}" style="color: #ef4444; text-decoration: none; font-size: 14px;">❌ Cancelar cita</a>
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            ⚠️ Este enlace expirará el <strong>${expiresAt.toLocaleDateString('es-MX')}</strong>.
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            Si no agendaste esta cita, puedes ignorar este correo.
          </p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder.</p>
        </div>
      </div>
    </html>
  `;
  
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@tutienda.com',
      to: appointment.customer_email,
      subject: `✅ Cita confirmada - ${storeName}`,
      html: emailHtml,
      text: `Hola ${appointment.customer_name},\n\nTu cita ha sido CONFIRMADA.\n\nFecha: ${formattedDate}\nHora: ${formattedTime}\n\nPara gestionar tu cita (cancelar), visita: ${link}\n\nEste enlace expirará el ${expiresAt.toLocaleDateString('es-MX')}.`
    });
    
    console.log('✅ Email de confirmación enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email de confirmación:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendAppointmentConfirmation, sendAppointmentConfirmed };