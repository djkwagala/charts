import { Component, createElement } from "react";
import * as classNames from "classnames";

import * as elementResize from "element-resize-detector";
import { ScatterHoverData } from "plotly.js";
import { newPlot, purge } from "../../PlotlyCustom";
import { Dimensions, getDimensions } from "../../utils/style";

import "../../ui/Charts.scss";

export interface LineChartProps extends Dimensions {
    data?: Plotly.ScatterData[];
    config?: Partial<Plotly.Config>;
    layout?: Partial<Plotly.Layout>;
    className?: string;
    style?: object;
    onClick?: () => void;
    onHover?: (node: HTMLDivElement, dataObject: mendix.lib.MxObject) => void;
}

export type Mode = "lines" | "markers" | "lines+markers";

export class LineChart extends Component<LineChartProps, {}> {
    private lineChartNode: HTMLDivElement;
    private tooltipNode: HTMLDivElement;
    private timeoutId: number;
    private data = [
        {
            connectgaps: true,
            mode: "lines+markers",
            name: "Sample",
            type: "scatter",
            x: [ 14, 20, 30, 50 ],
            y: [ 14, 30, 20, 40 ]
        }
    ] as Plotly.ScatterData[];

    constructor(props: LineChartProps) {
        super(props);

        this.getPlotlyNodeRef = this.getPlotlyNodeRef.bind(this);
        this.getTooltipNodeRef = this.getTooltipNodeRef.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onHover = this.onHover.bind(this);
        this.clearToolTip = this.clearToolTip.bind(this);
    }

    render() {
        return createElement("div",
            {
                className: classNames("widget-charts-line", this.props.className),
                ref: this.getPlotlyNodeRef,
                style: { ...getDimensions(this.props), ...this.props.style }
            },
            createElement("div", { className: "widget-charts-tooltip", ref: this.getTooltipNodeRef })
        );
    }

    componentDidMount() {
        this.renderChart(this.props);
        this.addResizeListener();
    }

    componentWillReceiveProps(newProps: LineChartProps) {
        this.renderChart(newProps);
    }

    componentWillUnmount() {
        if (this.lineChartNode) {
            purge(this.lineChartNode);
        }
    }

    private getPlotlyNodeRef(node: HTMLDivElement) {
        this.lineChartNode = node;
    }

    private getTooltipNodeRef(node: HTMLDivElement) {
        this.tooltipNode = node;
    }

    private addResizeListener() {
        const resizeDetector = elementResize({ strategy: "scroll" });
        if (this.lineChartNode.parentElement) {
            resizeDetector.listenTo(this.lineChartNode.parentElement, () => {
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId);
                }
                this.timeoutId = setTimeout(() => {
                    purge(this.lineChartNode);
                    this.renderChart(this.props);
                    this.timeoutId = 0;
                }, 100);
            });
        }
    }

    private renderChart(props: LineChartProps) {
        const data = props.data && props.data.length ? props.data : this.data;
        if (this.lineChartNode) {
            newPlot(this.lineChartNode, data, this.props.layout, this.props.config)
                .then(myPlot => {
                    myPlot.on("plotly_click", this.onClick);
                    myPlot.on("plotly_hover", this.onHover);
                    myPlot.on("plotly_unhover", this.clearToolTip);
                });
        }
    }

    private onClick() {
        if (this.props.onClick) {
            this.props.onClick();
        }
    }

    private onHover(data: ScatterHoverData) {
        if (this.props.onHover) {
            const activePoint = data.points[0];
            const positionYaxis = window.scrollY + activePoint.yaxis.l2p(activePoint.y) + activePoint.yaxis._offset;
            const positionXaxis = window.scrollX + activePoint.xaxis.d2p(activePoint.x) + activePoint.xaxis._offset;
            this.tooltipNode.style.top = `${positionYaxis}px`;
            this.tooltipNode.style.left = `${positionXaxis}px`;
            this.tooltipNode.style.opacity = "1";
            this.props.onHover(this.tooltipNode, activePoint.data.mxObjects[activePoint.pointNumber]);
        }
    }

    private clearToolTip() {
        this.tooltipNode.innerHTML = "";
        this.tooltipNode.style.opacity = "0";
    }
}
