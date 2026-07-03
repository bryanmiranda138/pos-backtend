require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// Configuración de conexión
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function crearVendedor() {
    try {
        console.log('Creando usuario vendedor...');

        // 1. Encriptamos la contraseña del vendedor ('ventas123')
        const salt = await bcrypt.genSalt(10);
        const hashSeguro = await bcrypt.hash('ventas123', salt);

        // 2. Insertamos el usuario en la base de datos
        const nuevoUsuario = await prisma.usuarios.create({
            data: {
                nombre: 'Cajero1',
                password_hash: hashSeguro,
                rol: 'vendedor' // Asignamos el rol restringido
            }
        });

        console.log(` ¡Éxito! Vendedor "${nuevoUsuario.nombre}" creado correctamente.`);
    } catch (error) {
        console.error(' Hubo un error al crear el vendedor:', error);
    } finally {
        await prisma.$disconnect();
    }
}

crearVendedor();