import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  TENANT_LEADERSHIP_ROLES,
  TENANT_MEMBER_ROLES,
} from "../common/constants/roles.constants";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  CreateSalesProspectDto,
  SalesProspectQueryDto,
  SalesProspectSummaryQueryDto,
  UpdateSalesProspectDto,
} from "./dto/sales-prospect.dto";
import { SalesProspectsService } from "./sales-prospects.service";

@ApiTags("Sales Prospects")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("sales/prospects")
export class SalesProspectsController {
  constructor(private prospectsService: SalesProspectsService) {}

  @ApiOperation({ summary: "List sales prospects" })
  @ApiOkResponse({ description: "Paginated sales prospects" })
  @Get()
  @Roles(...TENANT_MEMBER_ROLES)
  list(@CurrentUser() user: UserContext, @Query() query: SalesProspectQueryDto) {
    return this.prospectsService.list(user.userId, user.tenantId, query);
  }

  @ApiOperation({ summary: "Get sales prospect summary" })
  @ApiOkResponse({ description: "Sales prospect summary" })
  @Get("summary")
  @Roles(...TENANT_MEMBER_ROLES)
  summary(
    @CurrentUser() user: UserContext,
    @Query() query: SalesProspectSummaryQueryDto,
  ) {
    return this.prospectsService.summary(user.userId, user.tenantId, query.month);
  }

  @ApiOperation({ summary: "Get a sales prospect" })
  @ApiOkResponse({ description: "Sales prospect" })
  @Get(":id")
  @Roles(...TENANT_MEMBER_ROLES)
  getById(@CurrentUser() user: UserContext, @Param("id") id: string) {
    return this.prospectsService.getById(user.userId, user.tenantId, id);
  }

  @ApiOperation({ summary: "Create a sales prospect" })
  @ApiCreatedResponse({ description: "Sales prospect created" })
  @Post()
  @Roles(...TENANT_LEADERSHIP_ROLES)
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateSalesProspectDto,
  ) {
    return this.prospectsService.create(user.userId, user.tenantId, dto);
  }

  @ApiOperation({ summary: "Update a sales prospect" })
  @ApiOkResponse({ description: "Sales prospect updated" })
  @Patch(":id")
  @Roles(...TENANT_LEADERSHIP_ROLES)
  update(
    @CurrentUser() user: UserContext,
    @Param("id") id: string,
    @Body() dto: UpdateSalesProspectDto,
  ) {
    return this.prospectsService.update(user.userId, user.tenantId, id, dto);
  }

  @ApiOperation({ summary: "Delete a sales prospect" })
  @ApiOkResponse({ description: "Sales prospect deleted" })
  @Delete(":id")
  @Roles(...TENANT_LEADERSHIP_ROLES)
  remove(@CurrentUser() user: UserContext, @Param("id") id: string) {
    return this.prospectsService.remove(user.userId, user.tenantId, id);
  }
}
