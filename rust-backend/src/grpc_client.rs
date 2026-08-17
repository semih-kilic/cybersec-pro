use cybersec_proto::scan_engine::scan_engine_service_client::ScanEngineServiceClient;
use cybersec_proto::scan_engine::*;
use tonic::transport::Channel;

/// gRPC client for communicating with the scan engine.
/// Replaces the old reqwest-based JSON/REST calls.
#[derive(Clone)]
pub struct ScanEngineGrpcClient {
    client: ScanEngineServiceClient<Channel>,
}

impl ScanEngineGrpcClient {
    /// Connect to the scan engine via gRPC.
    /// `url` should be like "http://127.0.0.1:5003"
    pub async fn connect(url: &str) -> Result<Self, tonic::transport::Error> {
        let channel = Channel::from_shared(url.to_string())
            .expect("invalid gRPC URL")
            .connect()
            .await?;
        Ok(Self {
            client: ScanEngineServiceClient::new(channel),
        })
    }

    /// Start a scan — replaces `start_scan_on_engine` (POST /api/v3/scan)
    pub async fn start_scan(
        &mut self,
        tool: &str,
        target: &str,
        params: Option<serde_json::Value>,
        program: Option<String>,
        command_args: Option<Vec<String>>,
    ) -> Result<StartScanResponse, tonic::Status> {
        let params_json = params
            .map(|v| serde_json::to_string(&v).unwrap_or_default())
            .unwrap_or_default();

        let request = StartScanRequest {
            tool: tool.to_string(),
            target: target.to_string(),
            params_json,
            program: program.unwrap_or_default(),
            command_args: command_args.unwrap_or_default(),
        };

        self.client.start_scan(tonic::Request::new(request)).await.map(|r| r.into_inner())
    }

    /// Get scan status — replaces `fetch_scan_engine_status` (GET /api/v3/scan/:id/status)
    pub async fn get_status(&mut self, scan_id: &str) -> Result<ScanStatus, tonic::Status> {
        let request = GetScanStatusRequest {
            scan_id: scan_id.to_string(),
        };
        self.client.get_scan_status(tonic::Request::new(request)).await.map(|r| r.into_inner())
    }

    /// Cancel a scan — replaces POST /api/v3/scan/:id/cancel
    pub async fn cancel(&mut self, scan_id: &str) -> Result<CancelScanResponse, tonic::Status> {
        let request = CancelScanRequest {
            scan_id: scan_id.to_string(),
        };
        self.client.cancel_scan(tonic::Request::new(request)).await.map(|r| r.into_inner())
    }

    /// Get scan output — replaces GET /api/v3/scan/:id/output
    pub async fn get_output(&mut self, scan_id: &str) -> Result<ScanOutputResponse, tonic::Status> {
        let request = GetScanOutputRequest {
            scan_id: scan_id.to_string(),
        };
        self.client.get_scan_output(tonic::Request::new(request)).await.map(|r| r.into_inner())
    }

    /// Health check
    pub async fn health(&mut self) -> Result<HealthCheckResponse, tonic::Status> {
        self.client.health_check(tonic::Request::new(HealthCheckRequest {})).await.map(|r| r.into_inner())
    }
}
