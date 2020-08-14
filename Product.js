/* eslint-disable camelcase */
import capitalize              from 'lodash/capitalize';
import map                     from 'lodash/map';
import Sequelize               from 'sequelize';
import maxBy                   from 'lodash/maxBy';
import toLower                 from 'lodash/toLower';
import config                  from '../../etc/config.js';
import SequelizeSlugify        from './../extensions/SequelizeSlugify';
import Base                    from './Base';
import Option                  from './Option';
import Store                   from './Store';
import ActionProduct           from './ActionProduct';
import BannerProduct           from './BannerProduct';
import SeriesRelationProduct   from './SeriesRelationProduct';
import OrderProduct            from './OrderProduct';
import ProductOption           from './ProductOption';
import ProductPrice            from './ProductPrice';
import SiteProductQuantity     from './SiteProductQuantity';
import ProductPicture          from './ProductPicture';
import PotamusCategoryRelation from './PotamusCategoryRelation';
import ProductGenderText       from './ProductGenderText';
import OptionVariant           from './OptionVariant';
import Action                  from './Action';
import Series                  from './Series';
import Category                from './Category';
import PostOffice              from './PostOffice';

const DT = Sequelize.DataTypes;
const Op = Sequelize.Op;

class Product extends Base {
    static tableName = 'products'

    static INDEX_FIELDS = {
        code : {
            type  : 'text',
            exact : true
        },
        model : {
            type : 'text'
        },
        reference : {
            type : 'text'
        },
        indexNameRu : {
            type : 'text',
            lang : 'ru'
        },
        indexNameUa : {
            type : 'text',
            lang : 'ua'
        },
        suggestRu : {
            type : 'completion',
            lang : 'ru'
        },
        suggestUa : {
            type : 'completion',
            lang : 'ua'
        }
    };

    static parseColumns = {
        A : 'articul',
        B : 'name',
        C : 'supplier',
        D : 'vendor',
        E : 'department',
        F : 'subDepartment',
        G : 'group',
        H : 'subGrout',
        I : 'style',
        J : 'brand',
        K : 'season',
        L : 'color',
        M : 'size',
        N : 'gender',
        O : 'x6',
        P : 'x7',
        Q : 'category',
        R : 'model',
        S : 'x10'
    }

    static parseValidationRules = {
        data : [
            'required',
            {
                'list_of_objects' : [
                    {
                        articul       : [ 'required', 'string' ],
                        name          : [ 'required', 'string' ],
                        supplier      : [ 'string' ],
                        vendor        : [ 'required', 'string' ],
                        department    : [ 'required', 'string' ],
                        subDepartment : [ 'required', 'string' ],
                        group         : [ 'required', 'string' ],
                        subGrout      : [ 'required', 'string' ],
                        style         : [ 'required', 'string' ],
                        brand         : [ 'string' ],
                        season        : [ 'required', 'string' ],
                        color         : [ 'string' ],
                        size          : [ 'string' ],
                        gender        : [ 'string' ],
                        x6            : [ 'string' ],
                        x7            : [ 'string' ],
                        category      : [ 'required', 'string' ],
                        model         : [ 'string' ],
                        x10           : [ 'string' ]
                    }
                ]
            }
        ]
    }

    static INDEX_NAME = 'product_index';

    static options = {
        createdAt  : 'created_at',
        updatedAt  : 'updated_at',
        // underscored : true,
        timestamps : true,
        modelName  : 'product',
        name       : {
            singular : 'product',
            plural   : 'products'
        },
        scopes : {
            detailed() {
                return {
                    include : Product.detailedInclude()
                };
            },
            list() {
                return {
                    include : Product.listInclude()
                };
            },
            inStock() {
                return {
                    where : {
                        inStock    : true,
                        active     : true,
                        outOfStock : false,
                        disabled   : false
                    }
                };
            },
            active() {
                return {
                    where : {
                        active   : true,
                        disabled : false
                    }
                };
            },
            simpleFilters(filters = []) {
                if (filters.length === 0) {
                    return {};
                }

                const where = {};
                const variantIds = map(filters, 'variants').flat(1);

                where['$options.variant_id$'] = variantIds;
                where['$options.filterable$'] = true;

                return {
                    where
                };
            },
            filters(filters = []) {
                if (filters.length === 0) {
                    return {};
                }

                const condition = {};

                condition[Op.or] = filters.map(filter => {
                    const key = filter.variants ? '$options.variant.slug$' : '$options.group.slug$';
                    const value = filter.variants ? filter.variants : filter.groups;

                    return {
                        '$options.option.slug$' : filter.option,
                        [key]                   : value
                    };
                });

                return {
                    where : {
                        [Op.and] : condition
                    }
                };
            },
            price({ minPrice, maxPrice }) {
                if (minPrice && maxPrice) {
                    return {
                        where : {
                            promoPrice : {
                                [Op.and] : {
                                    [Op.gte] : minPrice,
                                    [Op.lte] : maxPrice
                                }
                            }
                        }
                    };
                }

                return {};
            },
            id(id = null) {
                if (id) {
                    return {
                        where : { id }
                    };
                }

                return {};
            },
            categoryId(categoryId = null) {
                if (categoryId) {
                    return {
                        where : { categoryId }
                    };
                }

                return {};
            },
            brandId(brandId = null) {
                if (brandId) {
                    return {
                        where : { brandId }
                    };
                }

                return {};
            },
            optionVariantId(variantId = null) {
                if (variantId) {
                    return {
                        where : {
                            '$options.variant_id$' : variantId
                        }
                    };
                }

                return {};
            },
            category(model = null) {
                const where = {};

                let categoryIds = model && model.id ? [ model.id ] : null;

                if (categoryIds && model.categories) {
                    categoryIds = categoryIds.concat(map(model.categories, 'id'));
                }

                if (categoryIds) {
                    where.categoryId = { [Op.in]: categoryIds };
                }

                return { where };
            },
            slug(slug) {
                return {
                    where : { slug }
                };
            },
            codes(codes = null) {
                if (!codes) {
                    return {};
                }

                if (Array.isArray(codes)) {
                    return {
                        where : { code: { [Op.in]: codes } }
                    };
                }

                return {
                    where : {
                        code : { [Op.in]: Sequelize.literal(`(${codes})`) }
                    }
                };
            },
            order({ sortedBy, order, context }) {
                const lang = capitalize(context.lang);

                let sort = sortedBy;

                if (sort === 'name')  sort = `name${lang}`;

                return {
                    order : [ [ sort, order ], [ 'reference', 'DESC' ] ]
                };
            },
            search(search) {
                if (search) {
                    return {
                        where : {
                            code : { [Op.like]: `${search}%` }
                        }
                    };
                }

                return {};
            },
            exactSearch(search) {
                if (search) {
                    return {
                        where : {
                            [Op.or] : [
                                { reference: search.trim() },
                                { code: search.trim() }
                            ]
                        }
                    };
                }

                return {};
            },
            enabledForOrder(enabled) {
                if (enabled === 0 || enabled === false) {
                    return {
                        where : {
                            '$siteQuantities.store.code$' : { [Op.notIn]: Store.ENABLED_ORDER_STORES }
                        }
                    };
                }

                return {
                    where : {
                        '$siteQuantities.store.code$' : Store.ENABLED_ORDER_STORES
                    }
                };
            }
        },
        getterMethods : {
            name() {
                const lang = capitalize(this.lang());

                return this.getDataValue(`name${lang}`);
            },
            color() {
                const lang = capitalize(this.lang());
                const productOptions = this.getDataValue('options');
                const colorOption = productOptions ? productOptions.find(productOption => {
                    return productOption.option && productOption.option.code === Option.COLOR_OPTION_CODE;
                }) : null;

                return colorOption ? colorOption.variant.getDataValue(`value${lang}`) : '';
            },
            description() {
                const lang = capitalize(this.lang());

                return this.getDataValue(`description${lang}`);
            },
            metaTitle() {
                const lang = capitalize(this.lang());

                return this.getDataValue(`metaTitle${lang}`);
            },
            metaKeywords() {
                const lang = capitalize(this.lang());

                return this.getDataValue(`metaKeywords${lang}`);
            },
            metaDescription() {
                const lang = capitalize(this.lang());

                return this.getDataValue(`metaDescription${lang}`);
            },
            price() {
                return Math.round(this.getDataValue('price') * 100) / 100;
            },
            oldPrice() {
                return Math.round(this.getDataValue('oldPrice') * 100) / 100;
            },
            breadcrumbsCategories() {
                return this.category ? [ ...this.category.parentCategories, this.category ] : [];
            },
            previewOptions() {
                const options = [];

                if (!this.options) {
                    return null;
                }

                this.options.forEach(productOption => {
                    this.series.seriesOptions.forEach(seriesOption => {
                        if (productOption.option.id === seriesOption.optionId) options.push(productOption);
                    });
                });

                return options;
            },
            suggestRu() {
                return this.nameRu.toLowerCase().split(' ');
            },
            suggestUa() {
                return this.nameUa.toLowerCase().split(' ');
            },
            indexNameRu() {
                const sportOption = this.get('sportOption');

                return `${this.nameRu} ${sportOption ? sportOption.variant.valueRu : ''}`;
            },
            indexNameUa() {
                const sportOption = this.get('sportOption');

                return `${this.nameUa} ${sportOption ? sportOption.variant.valueUa : ''}`;
            },
            sportOption() {
                return (this.options || []).find(item => item.option.code === Option.SPORTS_OPTION_CODE);
            },
            cupSizeOption() {
                return (this.options || []).find(item => item.option.code === Option.CUP_SIZE_OPTION_CODE);
            },
            guaranteeOption() {
                return (this.options || []).find(item => item.option.code === Option.GUARANTEE_OPTION_CODE);
            },
            siteInStock() {
                const inStock = this.get('inStock');
                const outOfStock = this.get('outOfStock');

                return inStock && !outOfStock;
            }
        }
    }

    static schema = {
        id                : { type: DT.INTEGER(11), allowNull: false, primaryKey: true, autoIncrement: true },
        reference         : { type: DT.STRING(255), allowNull: true },
        style             : { type: DT.STRING(255), allowNull: true },
        model             : { type: DT.STRING(255), allowNull: true },
        art               : { type: DT.INTEGER(11), allowNull: true },
        code              : { type: DT.STRING(25), allowNull: false, defaultValue: '' },
        potamusName       : { type: DT.STRING(64), allowNull: true, field: 'potamus_name' },
        seriesId          : { type: DT.INTEGER(11), allowNull: true, field: 'series_id' },
        brandId           : { type: DT.BIGINT(11), allowNull: true, field: 'brand_id' },
        classId           : { type: DT.INTEGER(11), allowNull: true, field: 'class_id' },
        categoryId        : { type: DT.INTEGER(11), allowNull: true, field: 'category_id' },
        vendorId          : { type: DT.INTEGER(11), allowNull: true, field: 'vendor_id' },
        classCode         : { type: DT.STRING(25), allowNull: true, defaultValue: '', field: 'class_code' },
        vendorCode        : { type: DT.STRING(25), allowNull: true, defaultValue: '', field: 'vendor_code' },
        inStock           : { type: DT.BOOLEAN, allowNull: false, defaultValue: false, field: 'in_stock' },
        outOfStock        : { type: DT.BOOLEAN, allowNull: false, defaultValue: false, field: 'out_of_stock' },
        disabled          : { type: DT.BOOLEAN, allowNull: false, defaultValue: false },
        active            : { type: DT.BOOLEAN, allowNull: false, defaultValue: true },
        nameRu            : { type: DT.STRING(255), allowNull: true, defaultValue: '', field: 'name_ru' },
        nameUa            : { type: DT.STRING(255), allowNull: true, defaultValue: '', field: 'name_ua' },
        descriptionRu     : { type: DT.TEXT, allowNull: true },
        descriptionUa     : { type: DT.TEXT, allowNull: true },
        metaTitleRu       : { type: DT.STRING(255), allowNull: true },
        metaTitleUa       : { type: DT.STRING(255), allowNull: true },
        metaKeywordsRu    : { type: DT.STRING(255), allowNull: true },
        metaKeywordsUa    : { type: DT.STRING(255), allowNull: true },
        metaDescriptionRu : { type: DT.TEXT, allowNull: true },
        metaDescriptionUa : { type: DT.TEXT, allowNull: true },
        ean               : { type: DT.STRING(255), allowNull: true },
        weight            : { type: DT.FLOAT(12, 2), allowNull: false, defaultValue: '0.00' },
        width             : { type: DT.FLOAT(12, 2), allowNull: false, defaultValue: '0.00' },
        height            : { type: DT.FLOAT(12, 2), allowNull: false, defaultValue: '0.00' },
        lenght            : { type: DT.FLOAT(15, 3), allowNull: false, defaultValue: '0.000' },
        slug              : { type: DT.STRING(255), allowNull: true },
        price             : { type: DT.FLOAT(10, 2), allowNull: true },
        oldPrice          : { type: DT.FLOAT(10, 2), allowNull: true, field: 'old_price' },
        promoPrice        : { type: DT.FLOAT(10, 2), allowNull: true, defaultValue: 0 },
        createdAt         : { type: DT.DATE, field: 'created_at' },
        updatedAt         : { type: DT.DATE, field: 'updated_at' }
    }

    static initRelations(seq, models) {
        Product.ProductOption  = this.hasMany(models.ProductOption, {
            foreignKey : 'product_id',
            sourceKey  : 'id',
            as         : 'options'
        });

        Product.ProductPicture = this.hasMany(models.ProductPicture, {
            foreignKey : 'productId',
            sourceKey  : 'id',
            as         : 'images'
        });

        Product.ActionProduct  = this.hasMany(models.ActionProduct, {
            foreignKey : 'productId',
            sourceKey  : 'id',
            as         : 'actionProducts'
        });

        Product.Comment = this.hasMany(models.Comment, {
            foreignKey  : 'commentableId',
            constraints : false,
            scope       : {
                commentable : 'product'
            },
            as : 'comments'
        });

        Product.SeriesRelationProduct = this.hasMany(models.SeriesRelationProduct, {
            as         : 'seriesRelationProducts',
            foreignKey : 'product_id',
            sourceKey  : 'id'
        });

        Product.OrderProduct = this.hasMany(models.OrderProduct, {
            foreignKey : 'productId',
            sourceKey  : 'id',
            as         : 'orderProducts'
        });

        Product.LinkedProduct = this.hasMany(models.LinkedProduct,   {
            sourceKey  : 'id',
            foreignKey : 'linkedProductId',
            as         : 'linkedProducts'
        });

        Product.Vendor = this.belongsTo(models.Vendor,   {
            foreignKey : 'vendorId',
            as         : 'vendor'
        });

        Product.Brand = this.belongsTo(models.Brand,    {
            foreignKey : 'brandId',
            as         : 'brand'
        });

        Product.Category = this.belongsTo(models.Category, {
            foreignKey : 'categoryId',
            as         : 'category'
        });

        Product.Series = this.belongsTo(models.Series,   {
            foreignKey : 'seriesId',
            as         : 'series'
        });

        Product.ProductPrice = this.hasMany(models.ProductPrice,   {
            foreignKey : 'productId',
            as         : 'prices'
        });

        Product.ProductQuantity = this.hasMany(models.ProductQuantity,   {
            foreignKey : 'productId',
            as         : 'quantities'
        });

        this.hasMany(models.SiteProductQuantity,   {
            foreignKey : 'productId',
            as         : 'siteQuantities'
        });
    }

    static initHooks() {
        SequelizeSlugify.slugifyModel(Product, {
            source      : [ 'nameUa', 'reference' ],
            // suffixSource : [ 'reference' ],
            slugOptions : {
                lower       : true,
                replacement : '-'
            },
            overwrite : true,
            column    : 'slug',
            unique    : false
        });

        Product.beforeCreate('handleReference', Product.handleReference);
        Product.beforeUpdate('handleReference', Product.handleReference);
    }

    static handleReference(instance, options, next) {
        /* eslint-disable-next-line no-param-reassign*/
        instance.reference = instance.style || instance.model
            ? `${instance.style || ''}-${instance.model || ''}`
            : `reference-${instance.code}`;

        return next ? next(null, instance) : instance;
    }

    static modalInclude() {
        return [
            {
                separate    : true,
                association : 'options',
                where       : { isVisible: true },
                include     : [
                    {
                        required    : true,
                        association : Product.ProductOption.target.Option
                    },
                    {
                        association : Product.ProductOption.target.Variant
                    }
                ]
            },
            {
                separate    : true,
                association : Product.ProductPicture
            },
            {
                association : Product.Brand
            },
            {
                association : Product.Category,
                include     : [
                    {
                        association : Product.Category.target.Category
                    }
                ]
            },
            {
                separate    : true,
                association : 'actionProducts',
                include     : [
                    {
                        association : 'action'
                    }
                ]
            }
        ];
    }

    static detailedInclude(params = {}) {
        const { optionId } = params;

        return [
            {
                separate    : true,
                association : 'options',
                where       : optionId ? { optionId } : { isVisible: true },
                include     : [
                    {
                        association : Product.ProductOption.target.Option
                    },
                    {
                        association : Product.ProductOption.target.Variant
                    },
                    {
                        association : Product.ProductOption.target.Group
                    }
                ]
            },
            {
                separate    : true,
                association : Product.ProductPicture
            },
            {
                association : Product.Brand,
                include     : [
                    {
                        association : Product.Brand.target.Option
                    },
                    {
                        association : Product.Brand.target.Variant
                    },
                    {
                        association : Product.Brand.target.Group
                    }
                ]
            },
            {
                association : Product.Category,
                include     : [
                    {
                        association : Product.Category.target.Category
                    }
                ]
            },
            {
                separate    : true,
                association : 'actionProducts',
                include     : [
                    {
                        association : 'action'
                    }
                ]
            }
        ];
    }

    static listInclude() {
        return [
            {
                separate    : true,
                association : 'options',
                where       : { isTop: true },
                include     : [
                    {
                        required    : true,
                        association : Product.ProductOption.target.Option
                    },
                    {
                        association : Product.ProductOption.target.Variant
                    },
                    {
                        association : Product.ProductOption.target.Group
                    }
                ]
            },
            {
                separate    : true,
                association : Product.ProductPicture
            },
            {
                association : Product.Brand
            },
            {
                association : Product.Category,
                include     : [
                    {
                        association : Product.Category.target.Category
                    }
                ]
            },
            {
                separate    : true,
                association : 'actionProducts',
                include     : [
                    {
                        association : 'action'
                    }
                ]
            }
        ];
    }

    static filtersInclude() {
        return [
            {
                required    : true,
                attributes  : [],
                association : Product.ProductOption
            }
        ];
    }

    static optionsInclude(options) {
        return [
            {
                separate    : true,
                association : 'options',
                attributes  : [ 'id', 'optionId' ],
                where       : options ? { optionId: { [Op.in]: map(options, 'id') } } : {},
                include     : [
                    {
                        required    : true,
                        attributes  : [ 'id', 'nameUa', 'nameRu', 'code' ],
                        association : 'option'
                    },
                    {
                        attributes  : [ 'id', 'valueRu', 'valueUa' ],
                        association : 'variant'
                    }
                ]
            }
        ];
    }

    static storeFilterInclude() {
        return [
            {
                attributes  : [],
                association : 'siteQuantities',
                include     : {
                    attributes  : [],
                    association : 'store',
                    where       : {
                        code : Store.ENABLED_ORDER_STORES
                    }
                }
            }
        ];
    }

    static preloadedInclude() {
        return [
            {
                association : 'category',
                include     : {
                    association : 'parent'
                }
            },
            {
                association : 'options',
                separate    : true,
                include     : [
                    { association: 'option' },
                    { association: 'variant' }
                ]
            },
            { association: 'images',  separate: true },
            { association: 'comments', separate: true }
        ];
    }

    static cartInclude() {
        return [
            {
                association : 'options',
                separate    : true,
                include     : [
                    { association: Product.ProductOption.target.Option },
                    { association: Product.ProductOption.target.Variant }
                ]
            },
            { association: Product.ProductPicture, separate: true },
            { association: Product.Brand },
            { association: Product.Category },
            {
                separate    : true,
                association : 'actionProducts',
                include     : [
                    {
                        association : 'action'
                    }
                ]
            },
            {
                association : Product.Series,
                include     : [
                    { association: Product.Series.target.SeriesOption, separate: true }
                ]
            }
        ];
    }

    static async searchReferences(search, context) {
        if (!search) {
            return {
                references : null,
                suggest    : null
            };
        }

        const exactProduct = await Product.scope([
            { method: [ 'exactSearch', search ] }
        ]).findOne();

        if (exactProduct) {
            return {
                codes   : [ exactProduct.code ],
                suggest : null
            };
        }

        const lang = capitalize(context.lang);
        const data = await Product.searchAll(search);
        const suggest = data.suggest[`suggest${lang}`];

        const maxScore = maxBy(data.hits.hits, '_score');
        const hits = data.hits.hits.filter(hit => hit._score >= maxScore._score);

        return {
            codes   : hits.map(hit => hit._source.code),
            suggest : suggest.length && suggest[0].options.length && suggest[0].options[0].score > 0.75
                ? suggest[0].options[0]
                : null
        };
    }

    static async getDefaultAnalogs(sampleProduct, limit) {
        const {
            firstPriceVariation,
            secondPriceVariation,
            thirdPriceVariation
        } = config.analogs;

        let productIds = await Product.findAnalogs(sampleProduct, firstPriceVariation);

        if (productIds.length < limit) {
            productIds = await Product.findAnalogs(sampleProduct, secondPriceVariation);
        }

        if (productIds.length < limit) {
            productIds = await Product.findAnalogs(sampleProduct, thirdPriceVariation);
        }

        return Product.findAll({
            include : [
                {
                    association : 'images',
                    separate    : true
                },
                {
                    association : 'actionProducts',
                    required    : false,
                    include     : {
                        association : 'action',
                        required    : false
                    }
                }
            ],
            where : {
                id      : productIds,
                [Op.or] : [
                    { '$actionProducts.action.status$': Action.STATUS_ACTIVE },
                    { '$actionProducts.action.status$': null }
                ]
            },
            limit,
            subQuery : false
        });
    }

    static async findAnalogs(sampleProduct, priceVariation) {
        const productOption = sampleProduct.options.find(prOpt => prOpt.option.code === Option.GENDER_OPTION_CODE);

        const where = {
            seriesId   : { [Op.not]: sampleProduct.seriesId },
            categoryId : sampleProduct.categoryId,
            price      : {
                [Op.and] : {
                    [Op.lte] : sampleProduct.price * (1 + parseFloat(priceVariation)),
                    [Op.gte] : sampleProduct.price * (1 - parseFloat(priceVariation))
                }
            }
        };

        if (productOption) {
            where['$options.variant_id$'] = productOption.variantId;
        }

        const items = await Product.scope('inStock').findAll({
            include    : Product.filtersInclude(),
            where,
            subQuery   : false,
            group      : [ 'seriesId' ],
            attributes : [ 'id', 'seriesId' ]
        });

        return items.map(item => item.id);
    }

    static async destroyAll(where = {}, options = {}) {
        const products = await Product.findAll({
            where,
            attributes : [ 'id' ],
            ...options
        });

        for (const productId of products) {
            const product = await Product.findOne({
                where   : { id: productId.id },
                include : Product.preloadedInclude(),
                ...options
            });

            await product.destroy(options);
        }
    }

    async destroy(options) {
        await this.destroyRelations(options);

        return super.destroy(options);
    }

    async destroyRelations(options) {
        await ActionProduct.destroy({ where: { productId: this.id }, ...options });
        await BannerProduct.destroy({ where: { productCode: this.code }, ...options });
        await SeriesRelationProduct.destroy({ where: { productId: this.id }, ...options });
        await OrderProduct.destroy({ where: { productId: this.id }, ...options });
        await ProductOption.destroy({ where: { productId: this.id }, ...options });

        if (this.images) {
            await Promise.all(this.images.map(item => item.destroy(options)));
        }

        if (this.comments) {
            await Promise.all(this.comments.map(item => item.destroy(options)));
        }
    }

    async sync(data, options = {}) {
        await this.update(data, options);

        const productOptions = await this.getOptions(options);

        const query = {
            [Op.or] : [
                { productId: this.id },
                { productId: null }
            ]
        };

        if (options.optionIds) {
            query.optionId = { [Op.in]: options.optionIds };
        }

        const sameProductOptions = [];

        let productOptionsToInsert = data.options || [];

        for (const productOption of productOptions) {
            productOptionsToInsert = productOptionsToInsert.filter(item => {
                const isSame = +productOption.optionId === +item.optionId
                    && +productOption.variantId === +item.variantId;

                if (isSame) {
                    sameProductOptions.push(productOption.id);
                }

                return !isSame;
            });
        }

        query.id = { [Op.notIn]: sameProductOptions };

        await ProductOption.destroy({
            where : query,
            ...options
        });

        await ProductOption.bulkCreate(productOptionsToInsert.map(item => ({
            productId  : this.id,
            categoryId : this.categoryId,
            ...item
        })), options);

        return this;
    }

    async initSitePrice(action, options = {}) {
        const quantities = await SiteProductQuantity.scope([
            // 'enabledForReserve',
            'enabledForOrder'
        ]).findAll({
            attributes : [ 'storeId' ],
            raw        : true,
            where      : { productId: this.id },
            include    : SiteProductQuantity.storeInclude(),
            group      : [ 'storeId' ]
            // having : Sequelize.where(Sequelize.fn('sum', Sequelize.col('quantity')), '>', '0')
        });

        const stores = await Store.scope([
            'enabledForOrder'
        ]).findAll({
            attributes : [ 'id' ],
            raw        : true
        });

        const price    = await ProductPrice.max('price', { where : {
            productId : this.id,
            storeId   : quantities.length ? map(quantities, 'storeId') : map(stores, 'id')
        } });

        const oldPrice = await ProductPrice.max('oldPrice', { where : {
            productId : this.id,
            storeId   : quantities.length ? map(quantities, 'storeId') : map(stores, 'id')
        } });

        let promoPrice = price;

        if (!price || !oldPrice) {
            return;
        }

        if (action) {
            promoPrice = await action.getProductPrice(this, options);
        }

        await this.update({
            price      : price || oldPrice || 0,
            oldPrice   : oldPrice || price || 0,
            promoPrice : promoPrice || oldPrice || 0
        }, options);
    }

    async initSiteInStore(options = {}) {
        const { productsVisibility } = config;

        if (productsVisibility === 'ALL') {
            return this.update({
                inStock    : true,
                active     : true,
                disabled   : false,
                outOfStock : false
            }, options);
        }

        let active = true;

        if (!this.brandId || !this.categoryId || this.price < 1) {
            active = false;
        }

        const pictureCount = await ProductPicture.count({ where: { productId: this.id }, ...options });

        if (pictureCount === 0) {
            active = false;
        }

        const quantity = await SiteProductQuantity.scope([
            'enabled',
            // 'enabledForReserve'
            'enabledForOrder'
        ]).sum('quantity', {
            where   : { productId: this.id },
            include : SiteProductQuantity.storeInclude()
        });

        const inStock = quantity > 0 && this.price > 1;

        await this.update({ inStock, active }, options);
    }

    async initNames(options = {})  {
        const defaultVariant = { valueRu: '', valueUa: '' };

        const produtOptions = await this.getOptions({
            include : [
                { association: 'option' },
                {
                    association : 'variant'
                }
            ],
            ...options
        });

        const kindOption   = produtOptions.find(item => item.option.code === Option.KIND_OPTION_CODE);
        const genderOption = produtOptions.find(item => item.option.code === Option.GENDER_OPTION_CODE);
        const brandOption  = produtOptions.find(item => item.option.code === Option.BRAND_OPTION_CODE);

        const type  = kindOption && kindOption.variant ? kindOption.variant : defaultVariant;
        const brand = brandOption && brandOption.variant ? brandOption.variant : defaultVariant;

        const gender = await ProductGenderText.getGenderText(genderOption, kindOption);

        const nameRu = `${type.valueRu} ${brand.valueRu} ${this.model || this.style || ''} ${toLower(gender.valueRu)}`.trim();
        const nameUa = `${type.valueUa} ${brand.valueUa} ${this.model || this.style || ''} ${toLower(gender.valueUa)}`.trim();

        return this.update({ nameRu, nameUa }, options);
    }

    async initCategoryAndKindOption(options = {}, log = console, kind = null) {
        const produtOptions = await this.getOptions({
            include : [
                { association: 'option' },
                { association: 'variant' }
            ],
            ...options
        });

        const originalKindOption = produtOptions.find(item => item.option.code === Option.ORIGINAL_KIND_OPTION_CODE);

        if (!originalKindOption) {
            return;
        }

        const potamusRelation = await PotamusCategoryRelation.findOne({
            where : { originalVariantId: originalKindOption.variant.id },
            ...options
        });

        if (potamusRelation && potamusRelation.categoryId && potamusRelation.variantId) {
            const kindOption = kind || await Option.kindOption();

            await this.update({ categoryId: potamusRelation.categoryId }, options);

            return ProductOption.updateOrCreate({
                productId : this.id,
                optionId  : kindOption.id
            }, {
                categoryId : this.categoryId,
                variantId  : potamusRelation.variantId
                // groupId ??
            }, options);
        }

        log.warn({ message: 'Category no found', code: this.code, originalKind: originalKindOption.variant.valueUa });
    }

    async initSiteSize(options, params) {
        await this.initSiteApparelSize(options, params);
        await this.initSiteFootwearSize(options, params);
        await this.initSiteHardwareSize(options, params);
    }

    async initSiteApparelSize(options = {}, params = {}) {
        const {
            logger,
            apparelSize,
            cupSize,
            category,
            apparel
        } = params;

        const sizeOption = apparelSize || await Option.apparelSizeOption(options);
        const cupSizeOption = cupSize || await Option.cupSizeOption(options);
        const productCategory = category || this.category || await this.getCategory(options);
        const rootCategory = apparel || await Category.apparel(options);

        await this.destroyOption([ cupSizeOption.id, sizeOption.id ], options);

        if (!this.categoryId || productCategory.parentId !== rootCategory.id) {
            return this;
        }

        const vendorSizeVariant     = await this.getOptionVariant(Option.ORIGINAL_SIZE_OPTION_CODE, options);
        const brandVariant          = await this.getOptionVariant(Option.BRAND_OPTION_CODE, options);
        const originalGenderVariant = await this.getOptionVariant(Option.ORIGINAL_GENDER_OPTION_CODE, options);
        const kindVariant           = await this.getOptionVariant(Option.KIND_OPTION_CODE, options);

        const vendorSize = vendorSizeVariant ? vendorSizeVariant.valueUa : null;
        const brand = brandVariant ? brandVariant.valueUa : null;
        const gender = originalGenderVariant ? originalGenderVariant.valueUa  : null;
        const tpg = kindVariant ? kindVariant.valueUa : null;

        const sizeVariant = vendorSize ? await OptionVariant.apparelSizeVariant(
            sizeOption, vendorSize, brand, gender, tpg, options, logger || console
        ) : null;

        const cupSizeVariant = vendorSize ? await OptionVariant.cupSizeVariant(
            cupSizeOption, vendorSize, brand, tpg, options, logger || console
        ) : null;

        if (sizeVariant) {
            await this.createOption(sizeOption.id, sizeVariant, {}, options);
        }

        if (cupSizeVariant) {
            await this.createOption(cupSizeOption.id, cupSizeVariant, {}, options);
        }
    }

    async initSiteFootwearSize(options = {}, params = {}) {
        const {
            logger,
            footwearSize,
            insoleLength,
            category,
            footwear
        } = params;

        const sizeOption = footwearSize || await Option.footwearSizeOption(options);
        const insoleLengthOption = insoleLength || await Option.insoleLengthOption(options);
        const productCategory = category || await this.getCategory(options);
        const rootCategory = footwear || await Category.footwear(options);

        await this.destroyOption([ insoleLengthOption.id, sizeOption.id ], options);

        if (!this.categoryId || productCategory.parentId !== rootCategory.id) {
            return this;
        }

        const vendorSizeVariant     = await this.getOptionVariant(Option.ORIGINAL_SIZE_OPTION_CODE, options);
        const brandVariant          = await this.getOptionVariant(Option.BRAND_OPTION_CODE, options);
        const originalGenderVariant = await this.getOptionVariant(Option.ORIGINAL_GENDER_OPTION_CODE, options);
        const kindVariant           = await this.getOptionVariant(Option.KIND_OPTION_CODE, options);

        const vendorSize = vendorSizeVariant ? (vendorSizeVariant.valueUa).replace(',', '.') : null;
        const brand = brandVariant ? brandVariant.valueUa : null;
        const gender = originalGenderVariant ? originalGenderVariant.valueUa  : null;
        const tpg = kindVariant ? kindVariant.valueUa : null;

        const sizeVariant = vendorSize ? await OptionVariant.footwearSizeVariant(
            sizeOption, vendorSize, brand, gender, tpg, options, logger || console
        ) : null;

        const insoleLengthVariant = vendorSize ? await OptionVariant.insoleLengthVariant(
            insoleLengthOption, vendorSize, brand, gender, tpg, options, logger || console
        ) : null;

        if (sizeVariant) {
            await this.createOption(sizeOption.id, sizeVariant, {}, options);
        }

        if (insoleLengthVariant) {
            await this.createOption(insoleLengthOption.id, insoleLengthVariant, {}, options);
        }
    }

    async initSiteHardwareSize(options = {}, params = {}) {
        const {
            logger,
            hardwareSize,
            category,
            hardware
        } = params;

        const sizeOption = hardwareSize || await Option.hardwareSizeOption(options);
        const productCategory = category || await this.getCategory(options);
        const rootCategory = hardware || await Category.hardware(options);

        await this.destroyOption([ sizeOption.id ], options);

        if (!this.categoryId || productCategory.parentId !== rootCategory.id) {
            return this;
        }

        const vendorSizeVariant = await this.getOptionVariant(Option.ORIGINAL_SIZE_OPTION_CODE, options);

        const vendorSize = vendorSizeVariant ? vendorSizeVariant.valueRu : null;

        const sizeVariant = vendorSize ? await OptionVariant.hardwareSizeVariant(
            sizeOption, vendorSize, options, logger
        ) : null;

        if (sizeVariant) {
            await this.createOption(sizeOption.id, sizeVariant, {}, options);
        }
    }

    async initSiteColor(options = {}, logger = console, colorOption = null) {
        const option = colorOption || await Option.colorOption(options);
        const sourceColorVariant = await this.getOptionVariant(Option.ORIGINAL_COLOR_OPTION_CODE, options);
        const sourceColor = sourceColorVariant ? sourceColorVariant.valueRu  : null;

        const colorVariants = sourceColor ? await OptionVariant.colorVariants(
            option, sourceColor, options
        ) : [];

        if (sourceColor && !colorVariants.length) {
            logger.warn(`Missing color variant: ${sourceColor}`);
        }

        await this.destroyOption(option.id, options);

        const productOptions = colorVariants.map(colorVariant => ({
            productId  : this.id,
            categoryId : this.categoryId,
            optionId   : option.id,
            groupId    : colorVariant.groupId,
            variantId  : colorVariant.id,
            filterable : this.inStock && this.active && !this.outOfStock && !this.disabled
        }));

        await ProductOption.bulkCreate(productOptions, options);
    }

    async initSiteSport(options = {}, logger = console, sportOption = null) {
        const option = sportOption || await Option.sportOption(options);

        const originalSportVariant = await this.getOptionVariant(Option.ORIGINAL_SPORTS_OPTION_CODE, options);
        const originalKindVariant  = await this.getOptionVariant(Option.ORIGINAL_KIND_OPTION_CODE, options);

        const potamusGroup = originalSportVariant ? originalSportVariant.valueRu  : null;
        const tpg = originalKindVariant ? originalKindVariant.valueRu : null;

        const { sportsVariant, additionalSport } = await OptionVariant.sportsVariant(
            option, potamusGroup, tpg, options, logger
        );

        await this.destroyOption(option.id, options);

        if (sportsVariant) {
            await this.createOption(option.id, sportsVariant, {}, options);
        }

        if (additionalSport) {
            await this.createOption(option.id, additionalSport, {}, options);
        }
    }

    async initSiteGender(options = {}, logger = console, genderOption = null) {
        const option = genderOption || await Option.genderOption(options);
        const sourceGenderVariant = await this.getOptionVariant(Option.ORIGINAL_GENDER_OPTION_CODE, options);

        const sourceGender = sourceGenderVariant ? sourceGenderVariant.valueRu : null;

        const genderVariant = sourceGender ? await OptionVariant.genderVariant(
            genderOption, sourceGender, options, logger
        ) : null;

        await this.destroyOption(option.id, options);

        if (genderVariant) {
            await this.createOption(option.id, genderVariant, {}, options);
        }
    }

    async initOutlet(options = {}, outletStores = [], outletOption = null) {
        const option = outletOption || await Option.outletOption(options);

        const data = {
            isFilter  : true,
            isVisible : false,
            isTop     : false
        };

        await this.destroyOption(option.id, options);

        const countInRegularStores = await SiteProductQuantity.count({
            where : {
                productId : this.id,
                storeId   : { [Op.notIn]: map(outletStores, 'id') },
                quantity  : { [Op.gt]: 0 }
            },
            ...options
        });

        const countInStores = await SiteProductQuantity.count({
            where : {
                productId : this.id,
                quantity  : { [Op.gt]: 0 }
            },
            ...options
        });

        const variant = countInStores > 0 && countInRegularStores === 0
            ? await OptionVariant.originalVariant(option, OptionVariant.OUTLET_VARIANT_OUTLET, options)
            : await OptionVariant.originalVariant(option, OptionVariant.OUTLET_VARIANT_REGULAR, options);

        await this.createOption(option.id, variant, data, options);
    }

    async initFilterableOptions(options = {}) {
        await ProductOption.update({
            filterable : this.inStock && this.active && !this.outOfStock && !this.disabled
        }, {
            where : { productId: this.id },
            ...options
        });
    }

    async assignSeries(options = {}) {
        const sourceKindVariant = await this.getOptionVariant(Option.ORIGINAL_KIND_OPTION_CODE, options);
        const sourceGenderVariant = await this.getOptionVariant(Option.ORIGINAL_GENDER_OPTION_CODE, options);

        const tpg = sourceKindVariant ? sourceKindVariant.valueRu : null;
        const gender = sourceGenderVariant ? sourceGenderVariant.valueRu : null;

        const seriesModel = Series.model(this.model, tpg, gender, this.reference, this.code);
        const [ series ]  = await Series.findOrCreate({ where: { model: seriesModel }, ...options });

        if (!this.seriesId || this.seriesId !== series.id) {
            return this.update({ seriesId: series.id }, options);
        }

        return this;
    }

    createPic(params, options = {}) {
        return ProductPicture.create({
            productId : this.id,
            ...params
        }, options);
    }

    removePics(options = {}) {
        return ProductPicture.destroy({ where: { productId: this.id }, options });
    }

    async getSizeVariant(options = {}, params = {}) {
        const { category } = params;
        const productCategory = category || this.category || await this.getCategory(options);

        if (!productCategory) {
            return null;
        }

        const sizeOption = await productCategory.getSizeOption(options);

        return this.getOptionVariant(sizeOption.code, options);
    }

    async getActiveAction() {
        return Action
            .scope([ 'active' ])
            .findOne({
                where   : { type: Action.POTAMUS_TYPE_FIXED_DISCOUNT },
                include : [
                    {
                        required    : true,
                        association : 'actionProducts',
                        where       : {
                            productId : this.id
                        }
                    }
                ]
            });
    }

    async destroyOption(optionId, options = {}) {
        await ProductOption.destroy({
            where : {
                productId : this.id,
                optionId
            },
            ...options
        });
    }

    async createOption(optionId, variant, data = {}, options = {}) {
        await ProductOption.create({
            optionId,
            productId  : this.id,
            categoryId : this.categoryId,
            variantId  : variant.id,
            groupId    : variant.groupId,
            filterable : this.inStock && this.active && !this.outOfStock && !this.disabled,
            ...data
        }, options);
    }

    // in kg
    async getWeight(options = {}) {
        const weightVariant = await this.getOptionVariant(Option.WEIGHT_OPTION_CODE, options);

        const weight = weightVariant ? +weightVariant.valueRu : +this.weight || 1000;

        return weight / 1000;
    }

    // m^3
    async getVolume(options = {}) {
        const height = await this.getHeight(options);
        const legth  = await this.getLength(options);
        const width  = await this.getWidth(options);

        return (height * legth * width || 1000000) / 1000000000;
    }

    // in kg
    async getVolumeWeight(company, options = {}) {
        const height = await this.getHeight(options);
        const legth  = await this.getLength(options);
        const width  = await this.getWidth(options);
        const weight = await this.getWeight(options);

        const weightBySize = company === PostOffice.COMPANY_JUSTIN
            ? height * width * legth * 100 * 250
            : height * width * legth / 4000 / 1000;

        return weightBySize > weight ? weightBySize : weight;
    }

    // mm
    async getLength(options = {}) {
        const legthVariant  = await this.getOptionVariant(Option.LENGTH_OPTION_CODE, options);

        const legth = legthVariant ? +legthVariant.valueRu : +this.lenght || 300;

        return legth;
    }

    // mm
    async getHeight(options = {}) {
        const heightVariant  = await this.getOptionVariant(Option.HEIGHT_OPTION_CODE, options);

        const height = heightVariant ? +heightVariant.valueRu : +this.height || 300;

        return height;
    }

    // mm
    async getWidth(options = {}) {
        const widthVariant  = await this.getOptionVariant(Option.WIDTH_OPTION_CODE, options);

        const width  = widthVariant ? +widthVariant.valueRu : +this.width || 300;

        return width;
    }

    async getOptionVariant(code, options = {}) {
        let productOption = null;

        if (this.options && this.options.length >= 0) {
            productOption = this.options.find(item => item.option.code === code);
        }

        if (!this.options) {
            const optionsList = await this.getOptions({
                include : [
                    { association: 'option', required: true, where: { code } },
                    { association: 'variant', required: true }
                ],
                ...options
            });

            productOption = optionsList[0];
        }

        return productOption ? productOption.variant : null;
    }
}

export default Product;
