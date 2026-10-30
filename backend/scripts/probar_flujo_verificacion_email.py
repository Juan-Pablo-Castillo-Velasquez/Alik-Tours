"""
Test de verificación de email
Prueba el flujo completo: Registro -> Email -> Verificación -> Login
"""

import requests

BASE_URL = "http://localhost:8000"

# Colores para output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def print_success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")


def print_error(msg):
    print(f"{RED}✗ {msg}{RESET}")


def print_info(msg):
    print(f"{BLUE}ℹ {msg}{RESET}")


def print_step(msg):
    print(f"\n{YELLOW}→ {msg}{RESET}")


def test_email_verification():
    """Prueba el flujo de verificación de email"""

    print(f"\n{BLUE}{'=' * 60}")
    print("TEST DE VERIFICACIÓN DE EMAIL")
    print(f"{'=' * 60}{RESET}\n")

    # Datos de prueba
    user_data = {
        "username": "test_user_email",
        "correo_electronico": "test@alectours.com",
        "password": "TestPassword123",
    }

    # ============ PASO 1: Registrar usuario ============
    print_step("1. Registrando usuario...")

    response = requests.post(f"{BASE_URL}/auth/register", json=user_data)

    if response.status_code != 201:
        print_error(f"Registro falló: {response.status_code}")
        print_error(response.json())
        return False

    register_response = response.json()
    print_success("Usuario registrado exitosamente")

    user_id = register_response.get("user_id")
    verification_token = register_response.get("verification_token")
    email = register_response.get("email")

    print_info(f"User ID: {user_id}")
    print_info(f"Email: {email}")
    print_info(f"Token de verificación generado: {verification_token[:50]}...")

    # ============ PASO 2: Intentar login sin verificar ============
    print_step("2. Intentando login sin email verificado...")

    login_data = {"username": user_data["username"], "password": user_data["password"]}

    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)

    if response.status_code == 403:
        error_msg = response.json().get("detail", "")
        if "verifica" in error_msg.lower():
            print_success(f"Acceso denegado correctamente: {error_msg}")
        else:
            print_error(f"Error inesperado: {error_msg}")
            return False
    else:
        print_error(f"Debería haber sido denegado (403), pero fue {response.status_code}")
        return False

    # ============ PASO 3: Verificar email ============
    print_step("3. Verificando email con token...")

    response = requests.post(f"{BASE_URL}/auth/verify-email", params={"token": verification_token})

    if response.status_code != 200:
        print_error(f"Verificación falló: {response.status_code}")
        print_error(response.json())
        return False

    verify_response = response.json()
    print_success("Email verificado exitosamente")
    print_info(verify_response.get("message", ""))

    # ============ PASO 4: Login después de verificar ============
    print_step("4. Iniciando sesión después de verificación...")

    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)

    if response.status_code != 200:
        print_error(f"Login falló: {response.status_code}")
        print_error(response.json())
        return False

    login_response = response.json()
    access_token = login_response.get("access_token")

    print_success("Login exitoso después de verificación")
    print_info(f"Access Token: {access_token[:50]}...")
    print_info(f"Token Type: {login_response.get('token_type')}")

    # ============ PASO 5: Usar el token para acceder a recursos ============
    print_step("5. Accediendo a recursos protegidos...")

    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.get(f"{BASE_URL}/api/clientes", headers=headers)

    if response.status_code == 200:
        print_success("Acceso a recursos protegidos autorizado")
        data = response.json()
        print_info(f"Clientes encontrados: {len(data) if isinstance(data, list) else 'N/A'}")
    else:
        print_error(f"Acceso denegado: {response.status_code}")

    # ============ RESUMEN ============
    print(f"\n{BLUE}{'=' * 60}")
    print("✓ TODOS LOS TESTS PASARON")
    print(f"{'=' * 60}{RESET}\n")

    return True


def test_invalid_token():
    """Prueba con token inválido"""

    print_step("Probando verificación con token inválido...")

    response = requests.post(f"{BASE_URL}/auth/verify-email", params={"token": "invalid.token.here"})

    if response.status_code == 400:
        print_success("Rechazo correcto para token inválido")
        print_info(response.json().get("detail", ""))
    else:
        print_error(f"Debería rechazar (400), fue {response.status_code}")


def test_duplicate_registration():
    """Prueba registro duplicado"""

    print_step("Probando registro con email duplicado...")

    user_data = {
        "username": "duplicate_user",
        "correo_electronico": "duplicate@test.com",
        "password": "TestPassword123",
    }

    # Primer registro
    response = requests.post(f"{BASE_URL}/auth/register", json=user_data)

    if response.status_code == 201:
        print_success("Primer registro exitoso")
    else:
        print_error(f"Primer registro falló: {response.status_code}")
        return

    # Segundo registro con mismo email
    user_data["username"] = "duplicate_user_2"

    response = requests.post(f"{BASE_URL}/auth/register", json=user_data)

    if response.status_code == 400:
        print_success("Rechazo correcto para email duplicado")
        print_info(response.json().get("detail", ""))
    else:
        print_error(f"Debería rechazar (400), fue {response.status_code}")


if __name__ == "__main__":
    print(f"{BLUE}Iniciando tests de verificación de email...{RESET}\n")

    try:
        # Test principal
        test_email_verification()

        # Tests adicionales
        print(f"\n{YELLOW}Tests adicionales:{RESET}")
        test_invalid_token()
        test_duplicate_registration()

    except requests.exceptions.ConnectionError:
        print_error("No se puede conectar al servidor en http://localhost:8000")
        print_info("Asegúrate que el servidor esté corriendo con: uvicorn app.main:app --reload")
    except Exception as e:
        print_error(f"Error inesperado: {str(e)}")
