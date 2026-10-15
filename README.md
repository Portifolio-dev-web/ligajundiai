# Liga Jundiaí

## Rodar localmente com Docker

Pré-requisitos: Docker Desktop instalado e em execução.

Na pasta do projeto, inicie a aplicação e o MongoDB:

```powershell
docker compose up --build
```

A aplicação ficará disponível em <http://localhost:3000>. O MongoDB será
iniciado junto com ela e os dados ficarão salvos no volume `mongo_data` entre
as execuções.

Para parar os serviços, pressione `Ctrl+C` e execute:

```powershell
docker compose down
```

Para apagar também os dados locais do MongoDB:

```powershell
docker compose down --volumes
```