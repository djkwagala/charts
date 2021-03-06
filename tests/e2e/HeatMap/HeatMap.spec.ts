import heatMap from "./pages/default.page";

describe("Heat Map", () => {
    beforeAll(() => {
        heatMap.open();
    });

    it("should generate a chart", () => {
        heatMap.heatMap.waitForVisible();
        const nodeName = heatMap.heatMap.getAttribute("nodeName");

        if (Array.isArray(nodeName)) {
            expect(nodeName[0]).toBe("svg");
        } else {
            expect(nodeName).toBe("svg");
        }
    });
});
