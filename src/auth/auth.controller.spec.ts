import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HeadersToDtoPipe } from '../pipes/headers-to-dto.pipe';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let headersToDtoPipe: HeadersToDtoPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            validateUser: jest.fn(),
          },
        },
        {
          provide: HeadersToDtoPipe,
          useValue: {
            transform: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    headersToDtoPipe = module.get<HeadersToDtoPipe>(HeadersToDtoPipe);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a user successfully', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: '123456',
        role: 'user',
      };

      const mockUser = {
        id: 1,
        email: registerDto.email,
        password: 'hashedPassword',
        role: registerDto.role, // Contraseña hasheada
        loginCount: 0,
        createdAt: new Date(),
        lastLoginAt: null,
      };

      // Mockeamos el método register del servicio
      (authService.register as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      // Verificamos que se llamó al servicio con los parámetros correctos
      expect(authService.register).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.password,
        registerDto.role,
      );
      
      // Verificamos que el resultado es el esperado
      expect(result).toEqual(mockUser);
    });

    it('should register a user with default role if not specified', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: '123456',
      };

      const mockUser = {
        id: 1,
        email: registerDto.email,
        password: 'hashedPassword',
        role: 'user', // Rol por defecto
        loginCount: 0,
        createdAt: new Date(),
        lastLoginAt: null,
      };

      (authService.register as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.password,
        undefined, // No se envía rol
      );
      expect(result.role).toBe('user');
    });
  });

describe('login', () => {
  it('should log in a user with valid headers', async () => {
    const mockHeaders = {
      email: 'test@example.com',
      password: '123456',
    };

    const loginDto: LoginDto = {
      email: mockHeaders.email,
      password: mockHeaders.password,
    };

    const mockUser = {
      id: 1,
      email: loginDto.email,
      password: 'hashedPassword', // Añadir password hasheado
      role: 'user',
      loginCount: 1,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    (headersToDtoPipe.transform as jest.Mock).mockResolvedValue(loginDto);
    (authService.validateUser as jest.Mock).mockResolvedValue(mockUser);

    const result = await controller.login(mockHeaders);

    expect(headersToDtoPipe.transform).toHaveBeenCalledWith(mockHeaders);
    expect(authService.validateUser).toHaveBeenCalledWith(
      loginDto.email,
      loginDto.password,
    );
    expect(result).toEqual(mockUser);
  });
});
})