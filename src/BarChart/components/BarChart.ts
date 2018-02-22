import { Component, ReactChild, ReactElement, createElement } from "react";

import { Alert } from "../../components/Alert";
import { ChartLoading } from "../../components/ChartLoading";
import { SeriesPlayground } from "../../components/SeriesPlayground";
import { PlotlyChart } from "../../components/PlotlyChart";

import { getRuntimeTraces, getSeriesTraces } from "../../utils/data";
import deepMerge from "deepmerge";
import { Container, Data } from "../../utils/namespaces";
import { Config, Layout, ScatterData, ScatterHoverData } from "plotly.js";
import { getDimensions, parseStyle } from "../../utils/style";

import "../../ui/Charts.scss";

export interface BarChartProps extends Container.BarChartContainerProps {
    alertMessage?: ReactChild;
    loading?: boolean;
    scatterData?: ScatterData[];
    seriesOptions?: string[];
    onClick?: (series: Data.SeriesProps, dataObject: mendix.lib.MxObject, mxform: mxui.lib.form._FormBase) => void;
    onHover?: (node: HTMLDivElement, tooltipForm: string, dataObject: mendix.lib.MxObject) => void;
}

interface BarChartState {
    layoutOptions: string;
    series?: Data.SeriesProps[];
    seriesOptions?: string[];
    scatterData?: ScatterData[];
    playgroundLoaded: boolean;
}

export class BarChart extends Component<BarChartProps, BarChartState> {
    state: BarChartState = {
        layoutOptions: this.props.layoutOptions,
        series: this.props.series,
        seriesOptions: this.props.seriesOptions,
        scatterData: this.props.scatterData,
        playgroundLoaded: false
    };
    private tooltipNode?: HTMLDivElement;
    private Playground?: typeof SeriesPlayground;

    constructor(props: BarChartProps) {
        super(props);

        if (props.devMode === "developer") {
            this.loadPlaygroundComponent();
        }
    }

    render() {
        if (this.props.alertMessage) {
            return createElement(Alert, { className: "widget-charts-bar-alert" }, this.props.alertMessage);
        }
        if (this.props.loading || (this.props.devMode === "developer" && !this.state.playgroundLoaded)) {
            return createElement(ChartLoading, { text: "Loading" });
        }
        if (this.props.devMode === "developer" && this.state.playgroundLoaded) {
            return this.renderPlayground();
        }

        return this.renderChart();
    }

    componentWillReceiveProps(newProps: BarChartProps) {
        this.setState({
            layoutOptions: newProps.layoutOptions,
            series: newProps.series,
            seriesOptions: newProps.seriesOptions,
            scatterData: newProps.scatterData
        });
    }

    private async loadPlaygroundComponent() {
        const { SeriesPlayground: PlaygroundImport } = await import("../../components/SeriesPlayground");
        this.Playground = PlaygroundImport;
        this.setState({ playgroundLoaded: true });
    }

    private getTooltipNodeRef = (node: HTMLDivElement) => {
        this.tooltipNode = node;
    }

    private renderChart() {
        return createElement(PlotlyChart,
            {
                type: "bar",
                className: this.props.class,
                style: { ...getDimensions(this.props), ...parseStyle(this.props.style) },
                layout: this.getLayoutOptions(this.props),
                data: this.getData(this.props),
                config: BarChart.getConfigOptions(),
                onClick: this.onClick,
                onHover: this.onHover,
                getTooltipNode: this.getTooltipNodeRef
            }
        );
    }

    private renderPlayground(): ReactElement<any> | null {
        if (this.Playground) {
            return createElement(this.Playground, {
                series: this.state.series,
                seriesOptions: this.props.seriesOptions || [],
                modelerSeriesConfigs: this.state.series && this.state.series.map(series =>
                    JSON.stringify(BarChart.getDefaultSeriesOptions(series, this.props), null, 4)
                ),
                onChange: this.onRuntimeUpdate,
                layoutOptions: this.state.layoutOptions || "{\n\n}",
                modelerLayoutConfigs: JSON.stringify(BarChart.defaultLayoutConfigs(this.props), null, 4)
            }, this.renderChart());
        }

        return null;
    }

    private getLayoutOptions(props: BarChartProps): Partial<Layout> {
        const advancedOptions = props.devMode !== "basic" && this.state.layoutOptions
            ? JSON.parse(this.state.layoutOptions)
            : {};

        return deepMerge.all([ BarChart.defaultLayoutConfigs(props), advancedOptions ]);
    }

    private getData(props: BarChartProps): ScatterData[] {
        if (props.scatterData && this.state.seriesOptions && props.devMode !== "basic") {
            return props.scatterData.map((data, index) => {
                const parsedOptions = this.state.seriesOptions
                    ? JSON.parse(this.state.seriesOptions[index])
                    : "{}";

                // deepmerge doesn't go into the prototype chain, so it can't be used for copying mxObjects
                return {
                    ...deepMerge.all<ScatterData>([ data, parsedOptions ]),
                    customdata: data.customdata
                };
            });
        }

        return props.scatterData || [];
    }

    private onClick = (data: ScatterHoverData<mendix.lib.MxObject>) => {
        const pointClicked = data.points[0];
        if (this.props.onClick) {
            this.props.onClick(pointClicked.data.series, pointClicked.customdata, this.props.mxform);
        }
    }

    private onHover = ({ points }: ScatterHoverData<mendix.lib.MxObject>) => {
        const { customdata, data, x, xaxis, y, yaxis } = points[0];
        if (this.props.onHover && data.series.tooltipForm && this.tooltipNode) {
            const yAxisPixels = typeof y === "number" ? yaxis.l2p(y) : yaxis.d2p(y);
            const xAxisPixels = typeof x === "number" ? xaxis.l2p(x as number) : xaxis.d2p(x);
            const positionYaxis = yAxisPixels + yaxis._offset;
            const positionXaxis = xAxisPixels + xaxis._offset;
            this.tooltipNode.style.top = `${positionYaxis}px`;
            this.tooltipNode.style.left = `${positionXaxis}px`;
            this.tooltipNode.style.opacity = "1";
            this.props.onHover(this.tooltipNode, data.series.tooltipForm, customdata);
        }
    }

    private onRuntimeUpdate = (layoutOptions: string, seriesOptions: string[]) => {
        this.setState({ layoutOptions, seriesOptions });
    }

    private static getConfigOptions(): Partial<Config> {
        return { displayModeBar: false, doubleClick: false };
    }

    public static getDefaultSeriesOptions(series: Data.SeriesProps, props: BarChartProps): Partial<ScatterData> {
        const hoverinfo = (props.orientation === "bar" ? "x" : "y") as any;

        return {
            name: series.name,
            type: "bar",
            hoverinfo: series.tooltipForm ? "text" : hoverinfo, // typings don't have a hoverinfo value of "y"
            orientation: props.orientation === "bar" ? "h" : "v"
        };
    }

    public static defaultLayoutConfigs(props: BarChartProps): Partial<Layout> {
        return {
            font: {
                family: "Open Sans, sans-serif",
                size: 12,
                color: "#888"
            },
            autosize: true,
            barmode: props.barMode,
            hovermode: "closest",
            showlegend: props.showLegend,
            xaxis: {
                gridcolor: "#eaeaea",
                zerolinecolor: props.orientation === "bar" ? "#eaeaea" : undefined,
                title: props.xAxisLabel,
                showgrid: props.grid === "vertical" || props.grid === "both",
                fixedrange: true
            },
            yaxis: {
                rangemode: "tozero",
                zeroline: true,
                zerolinecolor: "#eaeaea",
                gridcolor: "#eaeaea",
                title: props.yAxisLabel,
                showgrid: props.grid === "horizontal" || props.grid === "both",
                fixedrange: true
            },
            hoverlabel: {
                bgcolor: "#888",
                bordercolor: "#888",
                font: {
                    color: "#FFF"
                }
            },
            margin: {
                l: 60,
                r: 60,
                b: 60,
                t: 10,
                pad: 10
            }
        };
    }
}
