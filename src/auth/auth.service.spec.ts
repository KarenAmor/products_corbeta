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
      role: dto.role || 'user', 
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
      user: 'test@example.com',
      password: '123456',
    };
    
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');
    
    const result = await service.register(mockUser.user, mockUser.password);
    
    expect(bcrypt.hash).toHaveBeenCalledWith(mockUser.password, 10);
    expect(mockUserRepository.create).toHaveBeenCalledWith({
      user: mockUser.user,
      password: 'hashedPassword', 
      role: 'user', 
    });
    expect(mockUserRepository.save).toHaveBeenCalled();
    expect(result).toEqual({
      id: 1,
      user: mockUser.user,
      password: 'hashedPassword',
      role: 'user',
    });
  });
});