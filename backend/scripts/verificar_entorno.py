#!/usr/bin/env python3
"""
Script de verificación del setup de AlecTours Backend.

Uso:
    python verify_setup.py
"""

import os
import sys
from pathlib import Path


# Colores para output
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"


def print_success(msg):
    print(f"{Colors.GREEN}✓{Colors.RESET} {msg}")


def print_error(msg):
    print(f"{Colors.RED}✗{Colors.RESET} {msg}")


def print_warning(msg):
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {msg}")


def print_info(msg):
    print(f"{Colors.BLUE}ℹ{Colors.RESET} {msg}")


def check_env_file():
    """Verificar que el archivo .env existe."""
    print("\n1. Verificando archivo .env...")

    if os.path.exists(".env"):
        print_success(".env encontrado")

        # Verificar variables esenciales
        with open(".env") as f:
            content = f.read()

        required_vars = [
            "DATABASE_URL",
            "SECRET_KEY",
            "ALGORITHM",
            "ACCESS_TOKEN_EXPIRE_MINUTES",
            "MAIL_USERNAME",
            "MAIL_PASSWORD",
            "MAIL_FROM",
            "MAIL_PORT",
            "MAIL_SERVER",
            "MAIL_FROM_NAME",
        ]

        missing = []
        for var in required_vars:
            if var not in content:
                missing.append(var)

        if missing:
            print_warning(f"Variables faltantes en .env: {', '.join(missing)}")
        else:
            print_success("Todas las variables requeridas presentes")

        # Verificar SECRET_KEY
        if "SECRET_KEY=your-secret-key" in content or "SECRET_KEY=" in content:
            print_error("SECRET_KEY no configurado. Generar con:")
            print(f'  {Colors.BLUE}python -c "import secrets; print(secrets.token_urlsafe(32))"{Colors.RESET}')
            return False
        else:
            print_success("SECRET_KEY configurado")

    else:
        print_error(".env no encontrado")
        print_info("Copia .env.example a .env y configura las variables")
        return False

    return True


def check_dependencies():
    """Verificar que los paquetes necesarios están instalados."""
    print("\n2. Verificando dependencias...")

    required_packages = {
        "fastapi": "FastAPI",
        "sqlalchemy": "SQLAlchemy",
        "psycopg": "psycopg (PostgreSQL driver)",
        "pydantic": "Pydantic",
        "jose": "python-jose (JWT)",
        "passlib": "Passlib",
        "fastapi_mail": "FastAPI-Mail",
    }

    missing = []

    for package, name in required_packages.items():
        try:
            __import__(package)
            print_success(f"{name} instalado")
        except ImportError:
            missing.append(name)
            print_error(f"{name} NO instalado")

    if missing:
        print_warning("Ejecutar: pip install -r requirements.txt")
        return False

    return True


def check_directory_structure():
    """Verificar estructura de directorios."""
    print("\n3. Verificando estructura de directorios...")

    dirs = [
        "app/core",
        "app/models",
        "app/routes",
        "app/schemas",
        "app/services",
        "app/repositories",
        "alembic",
    ]

    all_exist = True
    for dir_path in dirs:
        if Path(dir_path).exists():
            print_success(f"Directorio {dir_path}/ existe")
        else:
            print_warning(f"Directorio {dir_path}/ no existe")
            all_exist = False

    return all_exist


def check_core_modules():
    """Verificar que los módulos core están completos."""
    print("\n4. Verificando módulos core...")

    modules = {
        "app/core/config.py": "Config (variables de entorno)",
        "app/core/database.py": "Database (SQLAlchemy)",
        "app/core/security.py": "Security (JWT y hashing)",
        "app/core/mail.py": "Mail (envío de emails)",
    }

    all_exist = True
    for path, description in modules.items():
        if Path(path).exists():
            file_size = Path(path).stat().st_size
            if file_size > 0:
                print_success(f"{description} ({path})")
            else:
                print_error(f"{description} está VACÍO ({path})")
                all_exist = False
        else:
            print_error(f"{description} NO EXISTE ({path})")
            all_exist = False

    return all_exist


def check_docker():
    """Verificar si Docker está disponible."""
    print("\n5. Verificando Docker...")

    try:
        import subprocess

        result = subprocess.run(["docker", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print_success(f"Docker instalado: {result.stdout.strip()}")
            return True
        else:
            print_error("Docker no parece funcionar correctamente")
            return False
    except FileNotFoundError:
        print_error("Docker no está instalado o no está en PATH")
        return False


def check_database_connection():
    """Intentar conectarse a la base de datos."""
    print("\n6. Verificando conexión a la base de datos...")

    try:
        from sqlalchemy import create_engine, text

        from app.core.config import settings

        print_info(f"Conectando a: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else '...'}")

        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as connection:
            result = connection.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print_success(f"Conexión exitosa: {version.split(',')[0]}")
            return True

    except Exception as e:
        print_error(f"No se pudo conectar a la BD: {str(e)}")
        print_info("Asegurate de que PostgreSQL está corriendo en Docker")
        print_info("Ejecuta: docker compose up -d postgres")
        return False


def print_summary(checks):
    """Imprimir resumen de verificaciones."""
    print(f"\n{'=' * 60}")
    print("RESUMEN")
    print(f"{'=' * 60}")

    passed = sum(checks.values())
    total = len(checks)

    for check_name, passed_check in checks.items():
        status = "PASÓ" if passed_check else "FALLÓ"
        icon = Colors.GREEN + "✓" + Colors.RESET if passed_check else Colors.RED + "✗" + Colors.RESET
        print(f"{icon} {check_name}: {status}")

    print(f"\nTotal: {passed}/{total} verificaciones pasadas")

    if passed == total:
        print(f"\n{Colors.GREEN}¡Todo configurado correctamente!{Colors.RESET}")
        print("\nProximos pasos:")
        print("1. Crear migraciones: alembic revision --autogenerate -m 'Create tables'")
        print("2. Ejecutar migraciones: alembic upgrade head")
        print("3. Iniciar servidor: uvicorn app.main:app --reload")
        return True
    else:
        print(f"\n{Colors.RED}Hay problemas a resolver.{Colors.RESET}")
        return False


def main():
    print(f"\n{Colors.BLUE}{'=' * 60}")
    print("VERIFICACIÓN DE SETUP - AlecTours Backend")
    print(f"{'=' * 60}{Colors.RESET}")

    checks = {
        ".env configurado": check_env_file(),
        "Dependencias instaladas": check_dependencies(),
        "Estructura de directorios": check_directory_structure(),
        "Módulos core completos": check_core_modules(),
        "Docker disponible": check_docker(),
    }

    # La verificación de DB es opcional (puede no estar corriendo)
    try:
        checks["Conexión a BD"] = check_database_connection()
    except Exception:
        checks["Conexión a BD"] = False

    success = print_summary(checks)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
