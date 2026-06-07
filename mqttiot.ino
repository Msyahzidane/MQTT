#define MQTT_MAX_PACKET_SIZE 512

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>

// ──────────────────────────────────────────────────────────────
//  WIFI
// ──────────────────────────────────────────────────────────────
#define WIFI_SSID  "oths"
#define WIFI_PASS  "12345678"

// ──────────────────────────────────────────────────────────────
//  PIN
// ──────────────────────────────────────────────────────────────
#define PIN_DHT  4
#define PIN_R1   23
#define PIN_R2   19
#define PIN_R3   18
#define PIN_R4   5

const uint8_t RELAY[4] = { PIN_R1, PIN_R2, PIN_R3, PIN_R4 };
#define R_ON  LOW
#define R_OFF HIGH

// ──────────────────────────────────────────────────────────────
//  DEFINISI BROKER (semua TLS port 8883)
// ──────────────────────────────────────────────────────────────
struct BrokerConfig {
  const char* label;
  const char* host;
  const char* clientId;
  const char* user;
  const char* pass;
};

const BrokerConfig BROKERS[3] = {
  {
    "Ably",
    "mqtt.ably.io",
    "ESP32_Home_01",
    "ZyRtEA.EIl0MA",
    "jN4OHGaVHf2rbXzVYZGSmdfwWQJq7LBrvmP1H_0xkVM"
  },
  {
    "Cedalo",
    "pf-ja6x4lxt1nt3206ohn7w.cedalo.cloud",
    "Esp",
    "Esp",
    "s"
  },
  {
    "CloudAMQP",
    "kingfisher.lmq.cloudamqp.com",
    "AMQPWeb",
    "jkhntckb:jkhntckb",
    "kvIQg8q622zZOqLhpTgo_v5M0nB8orRa"
  }
};

#define BROKER_PORT 8883

// ──────────────────────────────────────────────────────────────
//  TOPIK
// ──────────────────────────────────────────────────────────────
#define T_R1      "kontrol/relay1"
#define T_R2      "kontrol/relay2"
#define T_R3      "kontrol/relay3"
#define T_R4      "kontrol/relay4"
#define T_VAR     "kontrol/variasi"
#define T_BROKER  "kontrol/broker"
#define T_SUHU    "sensor/suhu"
#define T_HUMID   "sensor/kelembaban"

// ──────────────────────────────────────────────────────────────
//  KONSTANTA
// ──────────────────────────────────────────────────────────────
#define VARIASI_JEDA_MS  50
#define SENSOR_MS        5000

// ──────────────────────────────────────────────────────────────
//  OBJEK (semua TLS → pakai WiFiClientSecure)
// ──────────────────────────────────────────────────────────────
WiFiClientSecure  net;
PubSubClient      mqtt(net);
DHT               dht(PIN_DHT, DHT11);

// ──────────────────────────────────────────────────────────────
//  STATE
// ──────────────────────────────────────────────────────────────
int           brokerIdx       = 0;
bool          brokerSwitch    = false;
int           brokerSwitchTo  = 0;

int           variasiMode     = 0;
int           variasiStep     = 0;
unsigned long variasiLastTick = 0;
unsigned long waktuSensorLast = 0;

// ──────────────────────────────────────────────────────────────
//  WIFI
// ──────────────────────────────────────────────────────────────
void wifiConnect() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("\n[WiFi] Konek ke %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - t > 15000) { Serial.println(" TIMEOUT → restart"); ESP.restart(); }
    delay(400); Serial.print(".");
  }
  Serial.printf("\n[WiFi] OK · IP %s\n", WiFi.localIP().toString().c_str());
}

// ──────────────────────────────────────────────────────────────
//  RELAY
// ──────────────────────────────────────────────────────────────
void semuaOff() {
  for (int i = 0; i < 4; i++) digitalWrite(RELAY[i], R_OFF);
}

void nyalakanRelay(int idx, bool on) {
  if (idx < 0 || idx > 3) return;
  digitalWrite(RELAY[idx], on ? R_ON : R_OFF);
  Serial.printf("[Relay %d] %s\n", idx + 1, on ? "ON" : "OFF");
}

// ──────────────────────────────────────────────────────────────
//  VARIASI
// ──────────────────────────────────────────────────────────────
void tickVariasi() {
  if (variasiMode == 0) return;
  if (millis() - variasiLastTick < VARIASI_JEDA_MS) return;
  variasiLastTick = millis();
  semuaOff();
  int idx = (variasiMode == 1) ? (variasiStep % 4) : (3 - variasiStep % 4);
  digitalWrite(RELAY[idx], R_ON);
  variasiStep++;
}

// ──────────────────────────────────────────────────────────────
//  SUBSCRIBE
// ──────────────────────────────────────────────────────────────
void subscribeAll() {
  mqtt.subscribe(T_R1);
  mqtt.subscribe(T_R2);
  mqtt.subscribe(T_R3);
  mqtt.subscribe(T_R4);
  mqtt.subscribe(T_VAR);
  mqtt.subscribe(T_BROKER);
  Serial.println("[MQTT] Subscribe OK");
}

// ──────────────────────────────────────────────────────────────
//  GANTI BROKER
// ──────────────────────────────────────────────────────────────
void applyBrokerSwitch(int target) {
  if (target < 0 || target > 2) return;

  Serial.printf("\n[Broker] Beralih → %s\n", BROKERS[target].label);

  if (mqtt.connected()) mqtt.disconnect();
  delay(300);

  brokerIdx = target;
  const BrokerConfig& b = BROKERS[brokerIdx];

  net.setInsecure();
  mqtt.setServer(b.host, BROKER_PORT);

  Serial.printf("[MQTT] Konek ke %s:%d ... ", b.host, BROKER_PORT);
  if (mqtt.connect(b.clientId, b.user, b.pass)) {
    Serial.println("BERHASIL");
    subscribeAll();
  } else {
    Serial.printf("GAGAL rc=%d\n", mqtt.state());
  }
}

// ──────────────────────────────────────────────────────────────
//  RECONNECT
// ──────────────────────────────────────────────────────────────
void mqttReconnect() {
  const BrokerConfig& b = BROKERS[brokerIdx];
  Serial.printf("[MQTT] Reconnect %s ... ", b.label);
  net.setInsecure();
  if (mqtt.connect(b.clientId, b.user, b.pass)) {
    Serial.println("OK");
    subscribeAll();
  } else {
    Serial.printf("GAGAL rc=%d · retry 5s\n", mqtt.state());
    delay(5000);
  }
}

// ──────────────────────────────────────────────────────────────
//  MQTT CALLBACK
// ──────────────────────────────────────────────────────────────
void onMessage(char* topic, byte* data, unsigned int len) {
  char buf[64] = {};
  len = min(len, (unsigned int)63);
  memcpy(buf, data, len);
  int a = 0, b = (int)strlen(buf) - 1;
  while (a <= b && buf[a] <= ' ') a++;
  while (b >= a && buf[b] <= ' ') b--;
  String msg = String(buf).substring(a, b + 1);

  Serial.printf("[RX] %-22s → %s\n", topic, msg.c_str());

  // ── Ganti broker ─────────────────────────────────────────
  if (strcmp(topic, T_BROKER) == 0) {
    if (msg == "0" || msg == "1" || msg == "2") {
      brokerSwitchTo = msg.toInt();
      brokerSwitch   = true;
      Serial.printf("[Broker] Dijadwalkan → %s\n", BROKERS[brokerSwitchTo].label);
    } else {
      Serial.println("[Broker] Payload tidak valid. Kirim: 0 / 1 / 2");
    }
    return;
  }

  // ── Mode variasi ──────────────────────────────────────────
  if (strcmp(topic, T_VAR) == 0) {
    if (msg == "1" || msg == "2") {
      variasiMode = msg.toInt(); variasiStep = 0; variasiLastTick = 0;
      Serial.printf("[Variasi] Mode %d aktif\n", variasiMode);
    } else if (msg == "STOP") {
      variasiMode = 0; variasiStep = 0; semuaOff();
      Serial.println("[Variasi] Berhenti");
    }
    return;
  }

  // ── Kontrol relay manual ──────────────────────────────────
  if (variasiMode != 0) {
    Serial.println("[Info] Variasi aktif. Kirim STOP dulu.");
    return;
  }
  bool on = (msg == "ON");
  if      (strcmp(topic, T_R1) == 0) nyalakanRelay(0, on);
  else if (strcmp(topic, T_R2) == 0) nyalakanRelay(1, on);
  else if (strcmp(topic, T_R3) == 0) nyalakanRelay(2, on);
  else if (strcmp(topic, T_R4) == 0) nyalakanRelay(3, on);
}

// ──────────────────────────────────────────────────────────────
//  SENSOR
// ──────────────────────────────────────────────────────────────
void publishSensor() {
  float suhu  = dht.readTemperature();
  float humid = dht.readHumidity();
  if (isnan(suhu) || isnan(humid)) {
    Serial.println("[DHT11] Gagal baca!");
    return;
  }
  char buf[16];
  dtostrf(suhu,  4, 1, buf); mqtt.publish(T_SUHU,  buf);
  dtostrf(humid, 4, 1, buf); mqtt.publish(T_HUMID, buf);
  Serial.printf("[DHT11] %.1f°C | %.1f%%\n", suhu, humid);
}

// ──────────────────────────────────────────────────────────────
//  SETUP
// ──────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  for (int i = 0; i < 4; i++) {
    pinMode(RELAY[i], OUTPUT);
    digitalWrite(RELAY[i], R_OFF);
  }

  dht.begin();
  wifiConnect();

  mqtt.setCallback(onMessage);
  mqtt.setKeepAlive(60);
  mqtt.setBufferSize(512);

  applyBrokerSwitch(0);

  delay(2000);
  publishSensor();
  waktuSensorLast = millis();

  Serial.printf("\n[Ready] Broker: %s · Port: %d\n", BROKERS[brokerIdx].label, BROKER_PORT);
  Serial.println("[Info] kontrol/broker → 0=Ably | 1=Cedalo | 2=CloudAMQP");
}

// ──────────────────────────────────────────────────────────────
//  LOOP
// ──────────────────────────────────────────────────────────────
void loop() {
  if (WiFi.status() != WL_CONNECTED) wifiConnect();

  if (brokerSwitch) {
    brokerSwitch = false;
    applyBrokerSwitch(brokerSwitchTo);
  }

  if (!mqtt.connected()) mqttReconnect();

  mqtt.loop();
  tickVariasi();

  if (millis() - waktuSensorLast >= SENSOR_MS) {
    waktuSensorLast = millis();
    publishSensor();
  }
}