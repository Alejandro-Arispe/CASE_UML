import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  email: z.string().trim().email('El correo no es valido'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('El correo no es valido'),
  password: z.string().min(1, 'La contrasena es obligatoria'),
});
