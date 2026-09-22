package com.ridefit.ridefit.domain;

// "엔진오일 교환" 서비스에서 고를 수 있는 오일 종류. 매장 기본가(ShopMaintenancePrice)에 더해지는
// RIDEFIT 자체 옵션 추가금이다 - 특정 매장/브랜드의 실제 시세를 조사해 옮긴 값이 아니라
// RIDEFIT이 직접 정한 옵션 가격 정책이므로, 화면에도 "실제 브랜드/규격은 매장마다 다를 수 있다"는
// 안내를 함께 보여준다.
public enum EngineOilType {

    MINERAL("광유", "기본적인 주행에 적합한 합리적인 가격의 오일이에요.", 0),
    SEMI_SYNTHETIC("반합성유", "일상 주행과 관리 비용의 균형이 좋은 오일이에요.", 5000),
    FULL_SYNTHETIC("합성유", "고온·장거리 주행 등 가혹한 조건에 적합한 오일이에요.", 15000);

    private final String label;
    private final String description;
    private final int extraPrice;

    EngineOilType(String label, String description, int extraPrice) {
        this.label = label;
        this.description = description;
        this.extraPrice = extraPrice;
    }

    public String label() {
        return label;
    }

    public String description() {
        return description;
    }

    public int extraPrice() {
        return extraPrice;
    }
}
