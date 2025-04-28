# Proyecto de Gestión de Productos

Este es un proyecto backend desarrollado con **NestJS** que implementa un módulo de gestión de productos utilizando una base de datos **MySQL**, **TypeORM** como ORM, y **Nodemailer** para el envío de notificaciones por correo electrónico. Incluye carga masiva y un sistema de logs para registrar cambios. Además, se ha implementado autenticación basada en encabezados para proteger los endpoints del sistema.

## Tecnologías utilizadas

- **NestJS**: Framework principal para construir la API.
- **MySQL**: Base de datos relacional para almacenar los datos.
- **TypeORM**: ORM para interactuar con la base de datos.
- **Nodemailer**: Servicio para enviar correos electrónicos con notificaciones de errores.
- **Node.js**: Entorno de ejecución.
- **Swagger**: Documentación interactiva de la API.
- **Jest**: Framework para pruebas unitarias.

## Características

### Módulo de Autenticación
El sistema de autenticación se basa en el envío de credenciales a través de headers HTTP. No se utiliza JWT, sino que los endpoints protegidos requieren que el usuario envíe su correo electrónico y contraseña en los headers de la petición.

Validación de credenciales:

Los endpoints protegidos requieren los headers:
- **username**: Correo electrónico del usuario.
- **password**: Contraseña del usuario.

Encriptacion de la contraseña: en lenguaje javascript.
```bash
const bcrypt = require('bcrypt');
async function generateHash() {
  const password = 'estoesunaprueba';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  console.log('Hash generado:', hash);
}
generateHash();
```

Un AuthGuard verifica la autenticidad del usuario antes de procesar la petición.

- En caso de credenciales inválidas o ausencia de las mismas, se devuelve un error 401 Unauthorized.

### Módulo de Productos
El módulo de productos ofrece las siguientes funcionalidades:

1. **Funcionalidad**:
   - **Creación masiva**: Permite cargar múltiples productos al mismo tiempo sin interrumpir el flujo si hay errores (los registros válidos se guardan y los errores se notifican).

2. **Manejo de Errores**:
   - Cuando ocurre un error se envía una notificación por correo electrónico con los detalles del problema.
   - En la carga masiva, los errores no detienen el proceso; los productos válidos se registran y los errores se reportan por email.

3. **Sistema de Logs**:
   - Registra automáticamente las operaciones realizadas en el API (creación, modificación).
   - Cada cambio genera un log con la información relevante (como la `reference` o `id`, el tipo de operación y los datos antes/después).

4. **Pruebas Unitarias**:
  Se han implementado pruebas unitarias con Jest para garantizar la calidad del código en los siguientes módulos:
    - Autenticación: Se prueba la validación de credenciales y la respuesta del guardián de autenticación.
    - Productos: Se validan las operaciones CRUD, así como las reglas de negocio y validaciones.

5. **Documentación de la API**:
  Se ha utilizado Swagger para generar la documentación interactiva de la API. Para acceder a la documentación, inicie el servidor y diríjase a:
    ```bash
    http://localhost:3002/api-docs 
    ```

Esta documentación detalla todos los endpoints disponibles, los formatos de peticiones y respuestas, así como ejemplos de uso.

## Requisitos previos

- **Node.js** (versión 16.x o superior).
- **MySQL** (versión 8.x o superior).
- **NPM** o **Yarn** como gestor de paquetes.
- Una cuenta de correo para configurar **Nodemailer** (por ejemplo, Gmail con una contraseña de aplicación).

## Instalación

1. **Clona el repositorio**:
   ```bash
   git clone <url-del-repositorio>
   cd <nombre-del-proyecto>
   ```

2. **Instala las dependencias**:
   ```bash
   npm install
   ```

3. **Configura las variables de entorno**:
   - Copia el archivo `.env.example` a `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edita `.env` con tus valores reales:
    ```bash
     DB_HOST=tu_host_de_base_de_datos
     DB_PORT=puerto_de_base_de_datos
     DB_USERNAME=tu_usuario_de_base_de_datos
     DB_PASSWORD=tu_contraseña_de_base_de_datos
     DB_NAME=nombre_de_tu_base_de_datos
     DB_SYNCHRONIZE=true_o_false
     # SMTP Configuration
     SMTP_HOST=
     SMTP_PORT=
     SMTP_USER=
     SMTP_PASSWORD=
     SMTP_FROM_NAME=
     SMTP_FROM_EMAIL=
     EMAIL_NOTIFICATIONS_ENABLED=
     EMAIL_RECIPIENT=
     # Auth
     AUTH_USER=
     AUTH_PASSWORD_HASH=
    ```

4. **Inicializa la base de datos**:
   - Asegúrate de que MySQL esté corriendo.
   - Crea la base de datos especificada en `DB_DATABASE`.
   - TypeORM sincronizará las entidades automáticamente al iniciar la aplicación (si `synchronize: true` está configurado).

5. **Inicia la aplicación**:
    ```bash
    npm run start:dev
    ```
   - La API estará disponible en `http://localhost:3002` (o el puerto configurado).

## Uso

### Endpoints principale
Usa una herramienta como **Postman** o **cURL** para interactuar con la API. Aquí algunos ejemplos:

- **Carga masiva**:
  ```
  POST /products/
  {
  "products":
  [
    {"reference": "PROD001", "name": "Mouse", "vat": 5.00, "isActive": 1},
    {"reference": "PROD002", "name": "Monitor", "vat": 10.00, "isActive": true}
    {"reference": "PROD003", "name": "Mouse", "vat": 5.00, "isActive": 1},
    {"reference": "PROD004", "name": "Monitor", "vat": 10.00, "isActive": true}
  ]
  }
   ```
   ```
  POST /catalogs/
  {
    "catalogs": [
        {"name_catalog": "AUTOFOTON", "business_unit": "D1CAL", "is_active": 1},
        {"name_catalog": "AUTOFOTON", "business_unit": "DIMED", "is_active": 0},
        {"name_catalog": "AUTOFOTON", "business_unit": "DIBOG", "is_active": 1}
    ]
   }
  ```
   ```
   POST /product-prices
   {
    "product_prices": [
        {"business_unit": "DICAL", "catalog": "ABCD", "product_id":"00028845212457", "price": 220900, "vlr_impu_consumo": 0, "is_active": 0},
        {"business_unit": "DICAL", "catalog": "ABCD", "product_id":"00028845212457", "price": 220900, "vlr_impu_consumo": 0, "is_active": 0},
      ]
   }
   ```
    ```
    POST /product-stocks
    {
      "product_stock": [
         { "product_id": "REF0120", "business_unit": "DIMED", "stock": 5, "is_active": 1},
         { "product_id": "REF0120", "business_unit": "DIMED", "stock": 5, "is_active": 1},
         { "product_id": "REF0120", "business_unit": "DIMED", "stock": 5, "is_active": 1},
    ]
   }

   ```

## Contribuir

1. Haz un fork del repositorio.
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`).
3. Commitea tus cambios (`git commit -m "Agrega nueva funcionalidad"`).
4. Sube tu rama (`git push origin feature/nueva-funcionalidad`).
5. Abre un Pull Request.

## Licencia

[MIT]