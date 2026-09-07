import { NextFunction, Request, Response } from 'express';
import { User } from '../../../domain/entities';
import { LoginUser } from '../../../application/use-cases/auth/LoginUser';
import { RegisterUser } from '../../../application/use-cases/auth/RegisterUser';

// Nunca se expone passwordHash en las respuestas.
function toUserResponse(user: User) {
  return { id: user.id, name: user.name, email: user.email };
}

export function createAuthController(deps: { registerUser: RegisterUser; loginUser: LoginUser }) {
  return {
    async register(req: Request, res: Response, next: NextFunction) {
      try {
        const user = await deps.registerUser.execute(req.body);
        res.status(201).json(toUserResponse(user));
      } catch (err) {
        next(err);
      }
    },

    async login(req: Request, res: Response, next: NextFunction) {
      try {
        const { token, user } = await deps.loginUser.execute(req.body);
        res.json({ token, user: toUserResponse(user) });
      } catch (err) {
        next(err);
      }
    },
  };
}
