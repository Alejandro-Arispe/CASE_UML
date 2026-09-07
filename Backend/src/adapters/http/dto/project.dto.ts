import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'El proyecto debe tener un nombre'),
});

export const joinProjectSchema = z.object({
  inviteCode: z.string().trim().min(1, 'El codigo de invitacion es obligatorio'),
});
