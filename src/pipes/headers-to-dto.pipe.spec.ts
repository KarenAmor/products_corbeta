import { UnauthorizedException } from '@nestjs/common';
import { HeadersToDtoPipe } from './headers-to-dto.pipe';
import { LoginDto } from '../auth/dto/login.dto';

describe('HeadersToDtoPipe', () => {
  let pipe: HeadersToDtoPipe;

  beforeEach(() => {
    pipe = new HeadersToDtoPipe();
  });

  it('should transform headers to LoginDto', async () => {
    const headers = {
      email: 'test@example.com',
      password: '123456',
    };

    const result = await pipe.transform(headers);

    expect(result).toBeInstanceOf(LoginDto);
    expect(result.email).toBe(headers.email);
    expect(result.password).toBe(headers.password);
  });

  it('should throw UnauthorizedException if credentials are missing', async () => {
    const headers = { email: 'test@example.com' }; // Sin password

    await expect(pipe.transform(headers)).rejects.toThrow(UnauthorizedException);
  });
});