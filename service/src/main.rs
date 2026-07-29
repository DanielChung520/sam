use axum::{
    extract::State,
    http::{Method, StatusCode, Uri},
    response::IntoResponse,
    routing::{any, get},
    Json, Router,
};
use serde::Serialize;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
struct AppState {
    client: reqwest::Client,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    services: Vec<ServiceStatus>,
}

#[derive(Serialize)]
struct ServiceStatus {
    name: String,
    url: String,
    status: String,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        version: "0.1.0".into(),
        services: vec![
            ServiceStatus {
                name: "express-api".into(),
                url: "http://localhost:9091".into(),
                status: "configured".into(),
            },
        ],
    })
}

async fn proxy_handler(
    State(state): State<AppState>,
    method: Method,
    uri: Uri,
) -> impl IntoResponse {
    // Route /api/* to Express (port 9091)
    let target = format!("http://localhost:9091{}", uri);

    let req = state
        .client
        .request(method.clone(), &target)
        .build()
        .unwrap();

    match state.client.execute(req).await {
        Ok(resp) => {
            let status = resp.status();
            let headers = resp.headers().clone();
            let body = resp.bytes().await.unwrap_or_default();
            (status, headers, body).into_response()
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            [("content-type", "application/json")],
            format!("{{\"error\":\"upstream failed\",\"detail\":\"{}\"}}", e),
        )
            .into_response(),
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let state = AppState {
        client: reqwest::Client::new(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/{*path}", any(proxy_handler))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 9092));
    tracing::info!("sam-service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
