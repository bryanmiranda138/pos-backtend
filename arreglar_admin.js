require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// Configuración de conexión Prisma 7
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function encriptarContrasena() {
    try {
        // 1. Encriptar la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashSeguro = await bcrypt.hash('user1234', salt);

        // 2. Guardarla en la base de datos
        await prisma.usuarios.update({
            where: { id: 1 },
            data: { password_hash: hashSeguro }
        });

    } catch (error) {
        console.error('Hubo un error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

encriptarContrasena();