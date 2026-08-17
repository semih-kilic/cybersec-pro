use std::sync::Arc;
use tonic::{Request, Response, Status};
use cybersec_proto::scan_engine::scan_engine_service_server::{ScanEngineService, ScanEngineServiceServer};
use cybersec_proto::scan_engine::*;

use crate::scanner::ScanEngine;
use crate::models::ScanRequest;

#[derive(Clone)]
pub struct GrpcScanState {
    pub scan_engine: Arc<ScanEngine>,
}

#[tonic::async_trait]
impl ScanEngineService for GrpcScanState {
    async fn start_scan(
        &self,
        request: Request<StartScanRequest>,
    ) -> Result<Response<StartScanResponse>, Status> {
        let req = request.into_inner();
        let params = if req.params_json.is_empty() {
            None
        } else {
            serde_json::from_str(&req.params_json)
                .map_err(|e| Status::invalid_argument(format!("invalid params_json: {}", e)))?
        };
        let scan_req = ScanRequest {
            tool: req.tool,
            target: req.target,
            params,
            user_id: None,
            profile: None,
            timeout: None,
            program: if req.program.is_empty() { None } else { Some(req.program) },
            command_args: if req.command_args.is_empty() { None } else { Some(req.command_args) },
        };
        let scan_id = self.scan_engine.execute(scan_req).await
            .map_err(|e| Status::internal(format!("scan start failed: {}", e)))?;
        Ok(Response::new(StartScanResponse { scan_id, status: "running".to_string() }))
    }

    async fn get_scan_status(
        &self,
        request: Request<GetScanStatusRequest>,
    ) -> Result<Response<ScanStatus>, Status> {
        let scan_id = request.into_inner().scan_id;
        let status = self.scan_engine.get_status(&scan_id).await
            .map_err(|e| Status::not_found(format!("scan not found: {}", e)))?;
        Ok(Response::new(ScanStatus {
            scan_id: status.scan_id,
            status: format!("{:?}", status.status).to_lowercase(),
            tool: status.tool,
            target: status.target,
            started_at: status.started_at.timestamp(),
            finished_at: status.finished_at.map(|t| t.timestamp()).unwrap_or(0),
            progress: status.progress as u32,
            exit_code: status.exit_code.unwrap_or(0),
            error: status.error.unwrap_or_default(),
        }))
    }

    async fn cancel_scan(
        &self,
        request: Request<CancelScanRequest>,
    ) -> Result<Response<CancelScanResponse>, Status> {
        let scan_id = request.into_inner().scan_id;
        self.scan_engine.cancel(&scan_id).await
            .map_err(|e| Status::internal(format!("cancel failed: {}", e)))?;
        Ok(Response::new(CancelScanResponse { status: "cancelled".to_string() }))
    }

    async fn get_scan_output(
        &self,
        request: Request<GetScanOutputRequest>,
    ) -> Result<Response<ScanOutputResponse>, Status> {
        let scan_id = request.into_inner().scan_id;
        let output = self.scan_engine.get_output(&scan_id).await
            .map_err(|e| Status::internal(format!("output fetch failed: {}", e)))?;
        Ok(Response::new(ScanOutputResponse { output }))
    }

    async fn health_check(
        &self,
        _request: Request<HealthCheckRequest>,
    ) -> Result<Response<HealthCheckResponse>, Status> {
        Ok(Response::new(HealthCheckResponse {
            status: "healthy".to_string(),
            engine: "rust-scan-engine".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        }))
    }
}

pub fn grpc_router(state: GrpcScanState) -> axum::Router {
    tonic::service::Routes::new(ScanEngineServiceServer::new(state))
        .into_axum_router()
}
