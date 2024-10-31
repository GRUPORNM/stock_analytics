sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    "sap/suite/ui/commons/ChartContainer",
    "sap/suite/ui/commons/ChartContainerContent",
],
    function (BaseController, JSONModel, FlattenedDataset, FeedItem, ChartContainer, ChartContainerContent) {
        "use strict";

        return BaseController.extend("stockanalytics.controller.Main", {
            onInit: function () {
                var oViewModel = new JSONModel({
                    busy: false,
                    delay: 0,
                    oStandard: "tank,rec_date,rec_time,quantity,quantity_c,deadstock,cont_stock,max_volume,temperature,density_wunit",
                    oSmartTableView: "",
                    variantInput: "Standard"
                });
                sessionStorage.setItem("goToLaunchpad", "X");

                this.setModel(oViewModel, "mainView");
                this.getRouter().attachRouteMatched(this.getUserAuthentication, this);
            },

            // LIFECYCLE METHODS ******************************************************************************
            onRouteMatched: function (oEvent) {
                this.onBindView("/" + oEvent.getParameter("config").pattern.replace("/{objectId}"));
            },

            onBindView: function (sObjectPath) {
                if (sObjectPath) {
                    this.getView().bindElement({
                        path: sObjectPath,
                        change: this.onBindingChange.bind(this),
                        events: {
                            dataRequested: function () {
                                this.getModel("appView").setProperty("/busy", true);
                            }.bind(this),
                            dataReceived: function () {
                                this.getModel("appView").setProperty("/busy", false);

                            }.bind(this)
                        }
                    });
                }
            },

            onBindingChange: function () {
                var oView = this.getView(),
                    oElementBinding = oView.getElementBinding();

                if (!oElementBinding.getBoundContext()) {
                    this.getRouter().getTargets().display("NotFound");

                    return;
                }
            },
            // ************************************************************************************************

            onAfterRendering: function () {
                sessionStorage.setItem("goToLaunchpad", "X");
                if (sessionStorage.getItem("selectedTheme").indexOf("dark") !== -1) {
                    this.byId("variantInput").removeStyleClass("variantMode");
                    this.byId("variantInput").addStyleClass("variantModeBlack");
                    jQuery(".sapUiBlockLayer, .sapUiLocalBusyIndicator").css("background-color", "rgba(28,34,40,0.99)");
                }
                else {
                    this.byId("variantInput").removeStyleClass("variantModeBlack");
                    this.byId("variantInput").addStyleClass("variantMode");
                    jQuery(".sapUiBlockLayer, .sapUiLocalBusyIndicator").css("background-color", "rgba(255, 255, 255, 0.99)");
                }

            },

            onBeforeRendering: function () {
                this.onStartVariants();
            },


            onStartVariants: function () {
                var that = this,
                    oModel = this.getModel("vModel");

                oModel.read("/xTQAxUSR_VARIANTS_DD", {
                    success: function (oData) {
                        var oResults = oData.results;
                        debugger;
                        oResults.forEach(element => {
                            if (element.v_default) {
                                that.getModel("mainView").setProperty("/variantInput", element.v_name)
                                that.getModel("mainView").setProperty("/selectedVariant", element.variant_id);

                                if (element.variant_id != "Main") {
                                    var visibleInFilterBar = JSON.parse(atob(element.fbar_settings));
                                    that.onUpdateFilterBar(visibleInFilterBar);

                                    var visibleInFilterBar = JSON.parse(atob(element.schart_settings));
                                    that.onUpdateChart(visibleInFilterBar);

                                    var allFieldsInVariant = JSON.parse(atob(element.stable_settings));
                                    var allNames = allFieldsInVariant.map(function (obj) {
                                        return obj.name;
                                    }).join(',');

                                    // Remove a última vírgula, se necessário
                                    if (allNames.endsWith(',')) {
                                        allNames = allNames.substring(0, allNames.length - 1);
                                    }
                                    that.getModel("mainView").setProperty("/oSmartTableView", allNames);
                                    that.onBuildSmartTable();
                                }
                                else {
                                    that.getModel("mainView").setProperty("/oSmartTableView", that.getModel("mainView").getProperty("/oStandard"));
                                    that.onBuildSmartTable();
                                }
                            }
                        });
                    },
                    error: function (oError) {

                    }
                });
            },

            onBuildSmartTable: function () {
                var oOldSmartTable = sap.ui.getCore().byId("operationsTable");
                if (oOldSmartTable) {
                    oOldSmartTable.destroy();
                }

                var oDestroyedSmartTable = sap.ui.getCore().byId("operationsTable");
                if (!oDestroyedSmartTable) {
                    var oView = this.getView(),
                        oModel = this.getModel("mainView");

                    var oSmartTable = new sap.ui.comp.smarttable.SmartTable({
                        id: "operationsTable",
                        entitySet: "xTQAxSTOCK_ANALYTICS",
                        smartFilterId: "smartFilterBarGroups",
                        enableAutoBinding: true,
                        enableAutoColumnWidth: true,
                        showTablePersonalisation: false,
                        tableType: "Table",
                        useTablePersonalisation: true,
                        initialise: function () {
                            this.onSTinitialise.bind(this);
                        }.bind(this),
                        beforeRebindTable: this.onBeforeRebindTable.bind(this),
                        initiallyVisibleFields: oModel.getProperty("/oSmartTableView")
                    }).addStyleClass("sapUiSmallMarginTop");

                    var oAggregation = oView.byId("vbContent");
                    oAggregation.addItem(oSmartTable);

                    var oToolbar = new sap.m.OverflowToolbar({
                    });
                    oSmartTable.setCustomToolbar(oToolbar);
                }
            },

            onRouteMatched: function () {
                this.getUserAuthentication();
            },

            onFBarInitialise: function (oEvent) {
                var filterGroupItems = this.byId("smartFilterBarGroups").getFilterGroupItems(),
                    activeFiltersArray = [];

                filterGroupItems.forEach(function (item) {
                    if (item.mProperties.visibleInFilterBar) {
                        var filterInfo = {
                            name: item.mProperties.name,
                            visibleInFilterBar: item.mProperties.visibleInFilterBar
                        };
                        activeFiltersArray.push(filterInfo);
                    }
                });
                this.getModel("mainView").setProperty("/vStandard", activeFiltersArray);
            },

            onSTinitialise: function (oEvent) {
                var that = this,
                    oSmartTable = oEvent.getSource(),
                    oInnerTable = oSmartTable.getTable(),
                    aColumnData = [],
                    aColumns = oInnerTable.getColumns();

                aColumns.forEach(function (oColumn) {
                    var lastIndex = oColumn.sId.lastIndexOf('-');

                    if (lastIndex !== -1) {
                        var oName = oColumn.sId.substring(lastIndex + 1);
                    }
                    aColumnData.push({
                        name: oName
                    });
                });

                that.getModel("mainView").setProperty("/vSmartTableStandard", aColumnData);
            },


            onBeforeRebindTable: function (oEvent) {
                var that = this,
                    oSmartTable = oEvent.getSource(),
                    oInnerTable = oSmartTable.getTable(),
                    aNewColumnData = [],
                    aColumns = oInnerTable.getColumns();

                aColumns.forEach(function (oColumn) {
                    var lastIndex = oColumn.sId.lastIndexOf('-');

                    if (lastIndex !== -1) {
                        var oName = oColumn.sId.substring(lastIndex + 1);
                    }
                    if (oColumn.getVisible())
                        aNewColumnData.push({
                            name: oName
                        });
                });

                var isDifferent = this.checkArrayDifference(this.getModel("mainView").getProperty("/oSmartTableView"), aNewColumnData);
                if (isDifferent) {
                    var oInput = this.byId("variantInput"),
                        activeFiltersJSON = JSON.stringify(aNewColumnData),
                        activeFiltersBtoa = btoa(activeFiltersJSON);

                    this.getModel("mainView").setProperty("/SmartTableBtoa", activeFiltersBtoa);
                }
            },

            checkArrayDifference: function (a, b) {
                if (a.length !== b.length) {
                    return false;
                }

                var sortedA = a.slice().sort(),
                    sortedB = b.slice().sort();

                for (var i = 0; i < sortedA.length; i++) {
                    if (sortedA[i] !== sortedB[i]) {
                        return false;
                    }
                }

                return true;
            },

            onUpdateFilterBar: function (fbSettings) {
                var filterGroupItems = this.byId("smartFilterBarGroups").getFilterGroupItems();

                this.byId("smartFilterBarGroups").clear();

                filterGroupItems.forEach(oItem => {
                    oItem.setVisibleInFilterBar(false);
                });

                fbSettings.forEach(function (savedFilter) {
                    filterGroupItems.forEach(function (filterItem) {
                        if (savedFilter.name === filterItem.getName()) {
                            filterItem.setVisibleInFilterBar(true);

                            var control = filterItem.getControl();
                            var aFilters = savedFilter.aFilters;

                            if (aFilters && aFilters.length > 0) {
                                var filter = aFilters[0];
                                if (control instanceof sap.m.Input || control instanceof sap.m.MultiInput) {
                                    control.setValue("*" + filter.oValue1 + "*");
                                }
                                else if (control instanceof sap.m.Select || control instanceof sap.m.ComboBox) {
                                    control.setSelectedKey(filter.oValue1);
                                }
                                else if (control instanceof sap.m.CheckBox) {
                                    control.setSelected(filter.oValue1 === "true" || filter.oValue1 === true);
                                }
                            }
                        }
                    });
                });

            },

            onShowVariantList: function (oEvent) {
                var that = this,
                    oModel = this.getModel("vModel");

                if (!this._oPopover) {
                    var oList = new sap.m.List();
                    oList.setModel(oModel);
                    oList.bindItems({
                        path: "/xTQAxUSR_VARIANTS_DD",
                        template: new sap.m.StandardListItem({
                            title: "{v_name}"
                        })
                    });

                    oList.setMode(sap.m.ListMode.SingleSelectMaster);

                    oList.attachUpdateFinished(function () {
                        this.getItems().forEach(function (item) {
                            item.removeStyleClass("sapMSelectListItemBaseSelected");
                        });
                        this.getItems().forEach(function (item) {

                            var oBindingContext = item.getBindingContext();
                            var variant_id = oBindingContext.getProperty("variant_id");
                            var selectedV = that.getModel("mainView").getProperty("/selectedVariant");
                            if (!selectedV) {
                                if (variant_id === "Main") {
                                    item.addStyleClass("sapMSelectListItemBaseSelected");
                                }
                            }
                            else {
                                if (variant_id === selectedV) {
                                    item.addStyleClass("sapMSelectListItemBaseSelected");
                                    that.byId("variantInput").setValue(oBindingContext.getProperty("v_name"));
                                }
                            }
                        });
                    });

                    oList.attachSelectionChange(function (oEvent) {
                        this.getItems().forEach(function (item) {
                            item.removeStyleClass("sapMSelectListItemBaseSelected");
                        });

                        var oListItem = oEvent.getParameter("listItem");
                        oListItem.addStyleClass("sapMSelectListItemBaseSelected");

                        var oBindingContext = oListItem.getBindingContext();
                        var selectedVariant = oBindingContext.getProperty("variant_id");

                        that.getModel("mainView").setProperty("/selectedVariant", selectedVariant);
                        that.byId("variantInput").setValue(oBindingContext.getProperty("v_name"));

                        if (selectedVariant != "Main") {
                            var oObject = that.getModel("vModel").getObject(oBindingContext.sPath),
                                filterBarAtob = atob(oObject.fbar_settings),
                                filterBarArray = JSON.parse(filterBarAtob);
                            that.onUpdateFilterBar(filterBarArray);

                            var allFieldsInVariant = JSON.parse(atob(oObject.stable_settings));
                            var allNames = allFieldsInVariant.map(function (obj) {
                                return obj.name;
                            }).join(',');

                            // Remove a última vírgula, se necessário
                            if (allNames.endsWith(',')) {
                                allNames = allNames.substring(0, allNames.length - 1);
                            }

                            that.getModel("mainView").setProperty("/oSmartTableView", allNames);
                            that.onBuildSmartTable();
                        }
                        else {
                            that.onUpdateFilterBar(that.getModel("mainView").getProperty("/vStandard"));
                            that.getModel("mainView").setProperty("/oSmartTableView", that.getModel("mainView").getProperty("/oStandard"));
                            that.onBuildSmartTable();
                        }
                        that._oPopover.close();
                    });


                    this._oPopover = new sap.m.ResponsivePopover({
                        contentWidth: "25%",
                        title: this.getView().getModel("i18n").getResourceBundle().getText("MyViews"),
                        placement: "Bottom",
                        beginButton: new sap.m.Button({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("SaveAs"),
                            type: "Emphasized",
                            press: function () {
                                that.onBeforeSaveVariant();
                                this._oPopover.close();
                            }.bind(this)
                        }),
                        endButton: new sap.m.Button({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("Manage"),
                            press: function () {
                                that.onManageViews();
                                this._oPopover.close();
                            }.bind(this)
                        }),
                        content: [oList]
                    });
                }

                this._oPopover.openBy(oEvent.getSource());
            },

            onManageViews: function () {
                if (!this._oManageDialog) {
                    var oModel = this.getModel("vModel")
                    var oSearchBar = new sap.m.SearchField({
                        width: "100%",
                        placeholder: this.getView().getModel("i18n").getResourceBundle().getText("Search"),
                        liveChange: function (oEvent) {

                            var sQuery = oEvent.oSource.getValue();
                            var oFilter = new sap.ui.model.Filter("v_name", sap.ui.model.FilterOperator.Contains, sQuery);
                            oTable.getBinding("items").filter([oFilter]);
                        }
                    });

                    var oTable = new sap.m.Table({
                        columns: [
                            new sap.m.Column({ header: new sap.m.Label({ text: this.getView().getModel("i18n").getResourceBundle().getText("VariantName") }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: this.getView().getModel("i18n").getResourceBundle().getText("Default") }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: this.getView().getModel("i18n").getResourceBundle().getText("CreatedAt") }) }),
                            new sap.m.Column({ header: new sap.m.Label({ text: "" }) })
                        ]
                    });
                    oTable.setModel(oModel);

                    oTable.bindItems({
                        path: "/xTQAxUSR_VARIANTS_DD",
                        template: new sap.m.ColumnListItem({
                            cells: [
                                new sap.m.Text({ text: "{v_name}" }),
                                new sap.m.CheckBox({
                                    enabled: {
                                        path: 'variant_id',
                                        formatter: function (value) {
                                            if (value == "Main")
                                                return false;
                                        }
                                    },
                                    selected: "{v_default}",
                                    select: function (oEvent) {
                                        var oCheckBox = oEvent.getSource();
                                        var oContext = oCheckBox.getBindingContext();
                                        var selectedState = oCheckBox.getSelected();

                                        var oEntry = {};
                                        oEntry.v_default = selectedState;

                                        oModel.update(oContext.sPath, oEntry, {
                                            success: function (oCreatedData) {
                                                oModel.refresh(true);
                                            },
                                            error: function (oError) {

                                            }
                                        });
                                    }
                                }),
                                new sap.m.Text({
                                    text: {
                                        path: "created_at",
                                        type: new sap.ui.model.type.Date({
                                            pattern: "dd-MM-yyyy"
                                        })
                                    }
                                }),
                                new sap.m.Button({
                                    icon: "sap-icon://decline",
                                    visible: {
                                        path: 'v_name',
                                        formatter: function (variantName) {
                                            if (variantName == "Standard") {
                                                return false;
                                            }
                                        }
                                    },
                                    press: function (oEvent) {
                                        var oCheckBox = oEvent.getSource();
                                        var oContext = oCheckBox.getBindingContext();

                                        oModel.remove(oContext.sPath, {
                                            success: function (oCreatedData) {
                                            },
                                            error: function (oError) {
                                            }
                                        });
                                    }
                                })
                            ]
                        })
                    });

                    this._oManageDialog = new sap.m.Dialog({
                        title: this.getView().getModel("i18n").getResourceBundle().getText("Manageviews"),
                        content: [oSearchBar, oTable],
                        beginButton: new sap.m.Button({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("Close"),
                            press: function () {
                                this._oManageDialog.close();
                            }.bind(this)
                        })
                    });
                }

                this._oManageDialog.open();
            },

            onBeforeSaveVariant: function () {
                var that = this,
                    variantName = sap.ui.getCore().byId("inVariantName");
                if (!variantName) {
                    var oVariantName = new sap.m.Input({
                        id: "inVariantName"
                    });
                }

                var oCheckBox = new sap.m.CheckBox({
                    text: this.getView().getModel("i18n").getResourceBundle().getText("SetDefault")
                });

                var oDialog = new sap.m.Dialog({
                    title: this.getView().getModel("i18n").getResourceBundle().getText("SaveView"),
                    content: [
                        new sap.ui.layout.form.SimpleForm({
                            editable: true,
                            layout: "ResponsiveGridLayout",
                            content: [
                                new sap.m.Label({
                                    text: this.getView().getModel("i18n").getResourceBundle().getText("View")
                                }),
                                oVariantName,
                                oCheckBox
                            ]
                        })
                    ],
                    buttons: [
                        new sap.m.Button({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("Save"),
                            type: "Emphasized",
                            press: function () {
                                that.onSaveVariant(oVariantName.getValue(), oCheckBox.getSelected());
                                oDialog.destroy();
                            }
                        }),
                        new sap.m.Button({
                            text: this.getView().getModel("i18n").getResourceBundle().getText("Close"),
                            press: function () {
                                oDialog.close();
                                oDialog.destroy();
                            }
                        })
                    ]
                });

                oDialog.open();
            },

            onSaveVariant: function (VariantName, vDefault) {
                debugger;
                var that = this,
                    oModel = this.getModel("vModel"),
                    oEntry = {},
                    oFilterBarContext = [],
                    oFilterBar = this.byId("smartFilterBarGroups"),
                    oChart = this.byId("smartChartStock"),
                    filterChartItems = oChart._oChart.getVisibleMeasures(),
                    filterGroupItems = oFilterBar.getFilterGroupItems(),
                    activeFiltersArray = [];

                filterGroupItems.forEach(function (item) {
                    if (item.mProperties.visibleInFilterBar) {
                        var filterInfo = {
                            name: item.mProperties.name,
                            visibleInFilterBar: item.mProperties.visibleInFilterBar
                        };
                        activeFiltersArray.push(filterInfo);
                    }
                });

                var activeFiltersChartArray = filterChartItems.map(function (oFilterName) {
                    return {
                        name: oFilterName
                    };
                });

                var activeFiltersJSON = JSON.stringify(activeFiltersArray),
                    activeFiltersBtoa = btoa(activeFiltersJSON);

                var activeFiltersChartJSON = JSON.stringify(activeFiltersChartArray),
                    activeFiltersChartBtoa = btoa(activeFiltersChartJSON);

                this.getModel("mainView").setProperty("/fbarBtoa", activeFiltersBtoa);
                var oFilterAvailable = JSON.parse(atob(this.getModel("mainView").getProperty("/fbarBtoa")));

                oFilterBar.getFilters().forEach(element => {
                    var aFilters = element.aFilters;

                    var oMatchingFilter = oFilterAvailable.find(fs => fs.name === aFilters[0]?.sPath);

                    if (oMatchingFilter) {
                        oMatchingFilter.aFilters = aFilters.length > 0 ? aFilters : " ";

                    }
                });

                oEntry.v_name = VariantName;

                if (this.getModel("mainView").getProperty("/fbarBtoa"))
                    oEntry.fbar_settings = btoa(JSON.stringify(oFilterAvailable));
                else
                    oEntry.fbar_settings = btoa(JSON.stringify(this.getModel("mainView").getProperty("/vStandard")));
                if (this.getModel("mainView").getProperty("/SmartTableBtoa")) {
                    oEntry.stable_settings = this.getModel("mainView").getProperty("/SmartTableBtoa");
                }
                else {
                    var oTable = sap.ui.getCore().byId("operationsTable").getTable(),
                        aColumnData = [],
                        aColumns = oTable.getColumns();

                    aColumns.forEach(function (oColumn) {
                        var lastIndex = oColumn.sId.lastIndexOf('-');

                        if (lastIndex !== -1) {
                            var oName = oColumn.sId.substring(lastIndex + 1);
                        }
                        if (oColumn.getVisible())
                            aColumnData.push({
                                name: oName
                            });
                    });

                    oEntry.stable_settings = btoa(JSON.stringify(aColumnData));
                }

                if (activeFiltersChartBtoa) {
                    oEntry.schart_settings = activeFiltersChartBtoa;
                }

                oEntry.app_link = 'STOCK_ANALYTICS';
                oEntry.v_default = vDefault;

                oModel.create("/xTQAxUSR_VARIANTS_DD", oEntry, {
                    success: function (oCreatedData) {
                        that.getModel("mainView").setProperty("/selectedVariant", oCreatedData.variant_id);
                    },
                    error: function (oError) {

                    }
                });
            },

            onFilterChange: function (oEvent) {
                var filterGroupItems = oEvent.oSource.getFilterGroupItems(),
                    activeFiltersArray = [];

                filterGroupItems.forEach(function (item) {
                    if (item.mProperties.visibleInFilterBar) {
                        var filterInfo = {
                            name: item.mProperties.name,
                            visibleInFilterBar: item.mProperties.visibleInFilterBar
                        };
                        activeFiltersArray.push(filterInfo);
                    }
                });

                var activeFiltersJSON = JSON.stringify(activeFiltersArray),
                    activeFiltersBtoa = btoa(activeFiltersJSON);
                this.getModel("mainView").setProperty("/fbarBtoa", activeFiltersBtoa);

            },

            onUpdateChart: function (fbSettings) {
                var medidasNomes = fbSettings.map(function (medida) {
                    return medida.name;
                });
                debugger;
                this.byId("smartChartStock")._oChart.setVisibleMeasures(medidasNomes);
            },

        });
    });
