#!/usr/bin/env python3
"""
Ejemplo de uso: Registro, Login y Acceso a API
Muestra cómo usar el sistema de autenticación completo
"""

import json
from datetime import datetime

import requests

# Configuración
BASE_URL = "http://localhost:8000"
USERS = []  # Almacenar usuarios creados


class Colors:
    """Colores para terminal"""

    GREEN = "\033[92m"
    RED = "\033[91m"
    BLUE = "\033[94m"
    YELLOW = "\033[93m"
    END = "\033[0m"


def print_header(title):
    """Imprimir encabezado"""
    print(f"\n{Colors.BLUE}{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}{Colors.END}\n")


def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")


def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")


def print_info(msg):
    print(f"{Colors.YELLOW}ℹ️  {msg}{Colors.END}")


def print_json(data, label="Response"):
    """Imprimir JSON con formato"""
    print(f"{Colors.YELLOW}{label}:{Colors.END}")
    print(json.dumps(data, indent=2, ensure_ascii=False))


def register_user(username, email, password):
    """Registrar un usuario nuevo"""
    print_header(f"1. REGISTRANDO USUARIO: {username}")

    url = f"{BASE_URL}/auth/register"
    payload = {"username": username, "correo_electronico": email, "password": password}

    print_info(f"POST {url}")
    print_json(payload, "Request Body")

    try:
        response = requests.post(url, json=payload)

        if response.status_code == 201:
            data = response.json()
            print_success(f"Usuario '{username}' registrado exitosamente!")
            print_json(data, "Response Body")

            user_info = {
                "username": username,
                "email": email,
                "password": password,
                "access_token": data["access_token"],
                "refresh_token": data["refresh_token"],
                "token_type": data["token_type"],
            }
            USERS.append(user_info)

            return user_info
        else:
            print_error(f"Error {response.status_code}: {response.json()['detail']}")
            return None

    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return None


def login_user(username, password):
    """Iniciar sesión con un usuario existente"""
    print_header(f"2. LOGIN: {username}")

    url = f"{BASE_URL}/auth/login"
    payload = {"username": username, "password": password}

    print_info(f"POST {url}")
    print_json(payload, "Request Body")

    try:
        response = requests.post(url, json=payload)

        if response.status_code == 200:
            data = response.json()
            print_success(f"Sesión iniciada para '{username}'")
            print_json(data, "Response Body")

            return data["access_token"]
        else:
            print_error(f"Error {response.status_code}: {response.json()['detail']}")
            return None

    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return None


def get_clientes(access_token, username):
    """Obtener lista de clientes usando el token"""
    print_header(f"3. OBTENER CLIENTES (autenticado como {username})")

    url = f"{BASE_URL}/api/clientes"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    print_info(f"GET {url}")
    print_info(f"Authorization: Bearer {access_token[:30]}...")

    try:
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            print_success(f"Se obtuvieron {len(data)} clientes")

            if len(data) > 0:
                print(f"\n{Colors.YELLOW}Primeros clientes:{Colors.END}")
                for i, cliente in enumerate(data[:3]):
                    print(f"  {i + 1}. {cliente['nombre']} {cliente['apellido']} (ID: {cliente['id_cliente']})")
            return data
        else:
            print_error(f"Error {response.status_code}: {response.json()}")
            return None

    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return None


def create_cliente(access_token, username, nombre, apellido, cedula, email, celular):
    """Crear un cliente nuevo"""
    print_header(f"4. CREAR CLIENTE (autenticado como {username})")

    url = f"{BASE_URL}/api/clientes"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    payload = {"nombre": nombre, "apellido": apellido, "cedula": cedula, "correo": email, "celular": celular}

    print_info(f"POST {url}")
    print_json(payload, "Request Body")

    try:
        response = requests.post(url, json=payload, headers=headers)

        if response.status_code == 201:
            data = response.json()
            print_success(f"Cliente '{nombre} {apellido}' creado exitosamente!")
            print_json(data, "Response Body")
            return data
        else:
            print_error(f"Error {response.status_code}: {response.json()['detail']}")
            return None

    except Exception as e:
        print_error(f"Excepción: {str(e)}")
        return None


def test_invalid_login():
    """Probar login con credenciales inválidas"""
    print_header("5. PRUEBA: LOGIN CON CREDENCIALES INVÁLIDAS")

    url = f"{BASE_URL}/auth/login"
    payload = {"username": "usuario_inexistente", "password": "contraseña_incorrecta"}

    print_info(f"POST {url}")
    print_json(payload, "Request Body")

    try:
        response = requests.post(url, json=payload)

        if response.status_code == 401:
            print_success("Sistema rechazó credenciales inválidas (401)")
            print_json(response.json(), "Response Body")
        else:
            print_error(f"Respuesta inesperada: {response.status_code}")

    except Exception as e:
        print_error(f"Excepción: {str(e)}")


def test_invalid_register():
    """Probar registro con email inválido"""
    print_header("6. PRUEBA: REGISTRO CON EMAIL INVÁLIDO")

    url = f"{BASE_URL}/auth/register"
    payload = {"username": "usuario_nuevo", "correo_electronico": "esto-no-es-un-email", "password": "password123"}

    print_info(f"POST {url}")
    print_json(payload, "Request Body")

    try:
        response = requests.post(url, json=payload)

        if response.status_code == 422:
            print_success("Sistema validó email inválido (422)")
            print_json(response.json(), "Response Body")
        else:
            print_error(f"Respuesta inesperada: {response.status_code}")

    except Exception as e:
        print_error(f"Excepción: {str(e)}")


def main():
    """Función principal - Ejecutar ejemplos"""

    print(f"\n{Colors.BLUE}")
    print("╔" + "═" * 58 + "╗")
    print("║" + " " * 58 + "║")
    print("║" + "  DEMOSTRACIÓN: SISTEMA DE AUTENTICACIÓN".center(58) + "║")
    print("║" + "  Registro, Login y Acceso a API".center(58) + "║")
    print("║" + " " * 58 + "║")
    print("╚" + "═" * 58 + "╝")
    print(Colors.END)

    print(f"\n{Colors.YELLOW}Iniciando pruebas...{Colors.END}\n")
    print(f"Base URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # 1. Registrar usuario 1
    user1 = register_user("maria_garcia", "maria@example.com", "MariaPassword123")

    if not user1:
        print_error("No se pudo registrar usuario 1. Abortando...")
        return

    # 2. Registrar usuario 2
    user2 = register_user("carlos_lopez", "carlos@example.com", "CarlosPassword456")

    if not user2:
        print_error("No se pudo registrar usuario 2. Abortando...")
        return

    # 3. Obtener clientes con usuario 1
    get_clientes(user1["access_token"], user1["username"])

    # 4. Crear un cliente nuevo
    create_cliente(
        user1["access_token"], user1["username"], "Ana", "Martinez", "98765432", "ana@example.com", "3019876543"
    )

    # 5. Login con usuario 2
    token = login_user(user2["username"], user2["password"])

    if token:
        # 6. Obtener clientes con usuario 2
        get_clientes(token, user2["username"])

    # 7. Prueba: credenciales inválidas
    test_invalid_login()

    # 8. Prueba: email inválido
    test_invalid_register()

    # Resumen final
    print_header("RESUMEN FINAL")
    print(f"Usuarios creados: {len(USERS)}")
    for i, user in enumerate(USERS):
        print(f"  {i + 1}. {user['username']} ({user['email']})")
        print(f"     Token: {user['access_token'][:40]}...")

    print_success("\n¡Demostración completada exitosamente!")
    print(f"\n{Colors.YELLOW}Próximos pasos:{Colors.END}")
    print("  1. Abre http://localhost:8000/docs para ver documentación Swagger")
    print("  2. Prueba los endpoints manualmente en Thunder Client o Postman")
    print("  3. Implementa en tu frontend\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Cancelado por usuario{Colors.END}\n")
    except Exception as e:
        print_error(f"Error no controlado: {str(e)}")
