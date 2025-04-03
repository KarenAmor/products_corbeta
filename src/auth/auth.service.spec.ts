import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  const mockUserRepository = {
    create: jest.fn().mockImplementation((dto) => ({
      ...dto,
      role: dto.role || 'user', // Simula el valor por defecto del servicio
    })),
    save: jest.fn().mockImplementation((user) => Promise.resolve({ id: 1, ...user })),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should hash the password when registering', async () => {
    const mockUser = {
      email: 'test@example.com',
      password: '123456',
    };
    
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');
    
    const result = await service.register(mockUser.email, mockUser.password);
    
    expect(bcrypt.hash).toHaveBeenCalledWith(mockUser.password, 10);
    expect(mockUserRepository.create).toHaveBeenCalledWith({
      email: mockUser.email,
      password: 'hashedPassword', // Aseguramos que se hashee
      role: 'user', // Valor por defecto
    });
    expect(mockUserRepository.save).toHaveBeenCalled();
    expect(result).toEqual({
      id: 1,
      email: mockUser.email,
      password: 'hashedPassword',
      role: 'user',
    });
  });
});