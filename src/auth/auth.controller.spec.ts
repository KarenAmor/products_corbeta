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
        user: 'test@example.com',
        password: '123456',
        role: 'user',
      };

      const mockUser = {
        id: 1,
        user: registerDto.user,
        password: 'hashedPassword',
        role: registerDto.role, 
        loginCount: 0,
        createdAt: new Date(),
        lastLoginAt: null,
      };

      (authService.register as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(
        registerDto.user,
        registerDto.password,
        registerDto.role,
      );
      
      expect(result).toEqual(mockUser);
    });

    it('should register a user with default role if not specified', async () => {
      const registerDto: RegisterDto = {
        user: 'test@example.com',
        password: '123456',
      };

      const mockUser = {
        id: 1,
        user: registerDto.user,
        password: 'hashedPassword',
        role: 'user', // Rol por defecto
        loginCount: 0,
        createdAt: new Date(),
        lastLoginAt: null,
      };

      (authService.register as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(
        registerDto.user,
        registerDto.password,
        undefined, // No se envía rol
      );
      expect(result.role).toBe('user');
    });
  });

describe('login', () => {
  it('should log in a user with valid headers', async () => {
    const mockHeaders = {
      user: 'test@example.com',
      password: '123456',
    };

    const loginDto: LoginDto = {
      user: mockHeaders.user,
      password: mockHeaders.password,
    };

    const mockUser = {
      id: 1,
      user: loginDto.user,
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
      loginDto.user,
      loginDto.password,
    );
    expect(result).toEqual(mockUser);
  });
});
})